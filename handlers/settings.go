package handlers

import (
	"encoding/json"
	"html/template"
	"net/http"
	"os"

	"seiapanel/config"
	"seiapanel/middleware"
	"seiapanel/models"
)

// SettingsPage renders the settings page
func SettingsPage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	user, err := models.GetUserByID(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	session, _ := config.GetSessionStore().Get(r, "auth-session")

	tmpl, err := template.ParseFiles("templates/settings.html")
	if err != nil {
		http.Error(w, "Error loading template", http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"User":        user,
		"CurrentPath": config.GetServerPath(),
		"Success":     session.Flashes("success"),
		"Error":       session.Flashes("error"),
	}
	session.Save(r, w)

	tmpl.Execute(w, data)
}

// UpdateServerPath handles server folder path update - AJAX JSON response
func UpdateServerPath(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Parse form data
	if err := r.ParseForm(); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Error parsing form",
		})
		return
	}

	path := r.FormValue("path")

	// Validate input
	if path == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Path cannot be empty",
		})
		return
	}

	// Check if path exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Path does not exist",
		})
		return
	}

	// Check if path is a directory
	fileInfo, err := os.Stat(path)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Error accessing path: " + err.Error(),
		})
		return
	}

	if !fileInfo.IsDir() {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Path must be a directory",
		})
		return
	}

	// Update configuration
	if err := config.UpdateServerPath(path); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Error updating path: " + err.Error(),
		})
		return
	}

	// Return success response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Server folder path updated successfully",
		"path":    path,
	})
}