package handlers

import (
	"encoding/json"
	"html/template"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"seiapanel/config"
	"seiapanel/middleware"
	"seiapanel/models"
	"seiapanel/services"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Dashboard renders the home/dashboard page with server list
func Dashboard(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	user, err := models.GetUserByID(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Get server folder path
	serverPath := config.GetServerPath()

	// Get or scan servers
	var servers []models.Server
	if serverPath != "" {
		servers, err = scanAndSyncServers(userID, serverPath)
		if err != nil {
			// Log error but continue
		}
	}

	session, _ := config.GetSessionStore().Get(r, "auth-session")

	tmpl, err := template.ParseFiles("templates/dashboard.html")
	if err != nil {
		http.Error(w, "Error loading template", http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"User":    user,
		"Servers": servers,
		"Success": session.Flashes("success"),
		"Error":   session.Flashes("error"),
	}
	session.Save(r, w)

	tmpl.Execute(w, data)
}

// scanAndSyncServers scans the server folder and syncs with database
func scanAndSyncServers(userID uint, serverPath string) ([]models.Server, error) {
	// Get existing servers from database
	existingServers, err := models.GetServersByUserID(userID)
	if err != nil {
		existingServers = []models.Server{}
	}

	// Create map of existing servers
	serverMap := make(map[string]*models.Server)
	for i := range existingServers {
		serverMap[existingServers[i].Name] = &existingServers[i]
	}

	// Scan directories
	entries, err := ioutil.ReadDir(serverPath)
	if err != nil {
		return existingServers, err
	}

	// Track which servers are found in the new path
	foundServers := make(map[string]bool)

	for _, entry := range entries {
		if entry.IsDir() {
			serverName := entry.Name()
			fullPath := filepath.Join(serverPath, serverName)

			// Skip hidden directories and common non-server folders
			if strings.HasPrefix(serverName, ".") || 
			   serverName == "node_modules" || 
			   serverName == "cache" ||
			   serverName == "logs" ||
			   serverName == "backups" {
				continue
			}

			// Mark this server as found
			foundServers[serverName] = true

			// Check if server already exists
			if server, exists := serverMap[serverName]; exists {
				// Update the path if it changed
				if server.FolderPath != fullPath {
					server.FolderPath = fullPath
					models.DB.Save(server)
				}
			} else {
				// Find startup script
				startupCmd := findStartupCommand(fullPath)
				if startupCmd != "" {
					// Create new server entry
					models.CreateServer(serverName, fullPath, startupCmd, userID)
				}
			}
		}
	}

	// Delete servers that are no longer in the current path
	for _, server := range existingServers {
		if !foundServers[server.Name] {
			// Server is not in the new path, delete it
			models.DB.Delete(&server)
		}
	}

	// Return updated server list
	return models.GetServersByUserID(userID)
}

// findStartupCommand looks for common startup scripts/commands
func findStartupCommand(serverPath string) string {
	// Check for common script files
	scripts := []string{"start.sh", "start.bat", "run.sh", "run.bat"}
	for _, script := range scripts {
		scriptPath := filepath.Join(serverPath, script)
		if _, err := os.Stat(scriptPath); err == nil {
			return "./" + script
		}
	}

	// Look for server JAR files
	entries, err := ioutil.ReadDir(serverPath)
	if err != nil {
		return ""
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".jar") {
			// Default startup command without --nogui
			return "java -Xmx2G -Xms2G -jar " + entry.Name()
		}
	}

	return ""
}

// ServerConsolePage renders the server console page
func ServerConsolePage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	user, err := models.GetUserByID(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	session, _ := config.GetSessionStore().Get(r, "auth-session")

	tmpl, err := template.ParseFiles("templates/console.html")
	if err != nil {
		http.Error(w, "Error loading template", http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"User":    user,
		"Server":  server,
		"Success": session.Flashes("success"),
		"Error":   session.Flashes("error"),
	}
	session.Save(r, w)

	tmpl.Execute(w, data)
}

// StartServer handles starting a server
func StartServer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": "Server not found"})
		return
	}

	if err := services.StartServer(server); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "Server started successfully"})
}

// StopServer handles stopping a server
func StopServer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Server not found"})
		return
	}

	// Check if server is actually running
	if !services.IsServerRunning(server) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Server is not running"})
		return
	}

	if err := services.StopServer(server); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "Server stopped successfully"})
}

// RestartServer handles restarting a server
func RestartServer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Server not found"})
		return
	}

	// Check if server is actually running
	if !services.IsServerRunning(server) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Server is not running"})
		return
	}

	if err := services.RestartServer(server); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "Server restarted successfully"})
}

// SendCommand sends a command to the server console
func SendCommand(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": "Server not found"})
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Error parsing form", http.StatusBadRequest)
		return
	}

	command := r.FormValue("command")
	if command == "" {
		json.NewEncoder(w).Encode(map[string]string{"error": "Command cannot be empty"})
		return
	}

	if err := services.SendCommand(server, command); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "Command sent successfully"})
}

// GetLogs retrieves server logs
func GetLogs(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": "Server not found"})
		return
	}

	logs := services.GetLogs(server)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"logs": logs,
	})
}

// GetServerStats retrieves server statistics (memory, CPU, etc.)
func GetServerStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": "Server not found"})
		return
	}

	stats, err := services.GetServerStats(server)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// ConsoleWebSocket handles WebSocket connections for real-time console output
func ConsoleWebSocket(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// Register this connection to receive console updates
	services.AddConsoleListener(server, conn)
	defer services.RemoveConsoleListener(server, conn)

	// Keep connection alive and handle ping/pong
	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			break
		}
		
		// Handle ping from client
		if messageType == websocket.TextMessage && string(message) == "ping" {
			conn.WriteMessage(websocket.TextMessage, []byte("pong"))
		}
	}
}

// StartupPage renders the startup command page
func StartupPage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	user, err := models.GetUserByID(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	session, _ := config.GetSessionStore().Get(r, "auth-session")

	tmpl, err := template.ParseFiles("templates/startup.html")
	if err != nil {
		http.Error(w, "Error loading template", http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"User":    user,
		"Server":  server,
		"Success": session.Flashes("success"),
		"Error":   session.Flashes("error"),
	}
	session.Save(r, w)

	tmpl.Execute(w, data)
}

// UpdateStartup handles updating the startup command - AJAX JSON response
func UpdateStartup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Server not found",
		})
		return
	}

	if err := r.ParseForm(); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Error parsing form",
		})
		return
	}

	command := r.FormValue("command")

	if command == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Startup command cannot be empty",
		})
		return
	}

	if err := server.UpdateStartupCommand(command); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Error updating startup command: " + err.Error(),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Startup command updated successfully",
		"command": command,
	})
}