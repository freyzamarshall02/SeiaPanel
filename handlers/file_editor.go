package handlers

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"seiapanel/middleware"
	"seiapanel/models"

	"github.com/gorilla/mux"
)

// ReadFile reads the content of a file
func ReadFile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	// Get server
	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Server not found",
		})
		return
	}

	// Get file path from query parameter
	currentPath := r.URL.Query().Get("path")
	fileName := r.URL.Query().Get("file")

	if fileName == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "File name is required",
		})
		return
	}

	// Build full path
	var fullPath string
	if currentPath == "/" || currentPath == "" {
		fullPath = filepath.Join(server.FolderPath, fileName)
	} else {
		relativePath := strings.TrimPrefix(currentPath, "/")
		fullPath = filepath.Join(server.FolderPath, relativePath, fileName)
	}

	// Security check: ensure the path is within the server folder
	cleanPath := filepath.Clean(fullPath)
	if !strings.HasPrefix(cleanPath, server.FolderPath) {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied: path outside server directory",
		})
		return
	}

	// Check if file exists and is not a directory
	fileInfo, err := os.Stat(cleanPath)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "File not found",
		})
		return
	}

	if fileInfo.IsDir() {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Cannot read directory as file",
		})
		return
	}

	// Read file content
	content, err := ioutil.ReadFile(cleanPath)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to read file: " + err.Error(),
		})
		return
	}

	// Return success with file content
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"content": string(content),
		"name":    fileName,
		"size":    fileInfo.Size(),
	})
}

// WriteFile writes content to a file
func WriteFile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	// Get server
	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Server not found",
		})
		return
	}

	// Parse form data
	if err := r.ParseForm(); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Error parsing form",
		})
		return
	}

	currentPath := r.FormValue("path")
	fileName := r.FormValue("file")
	content := r.FormValue("content")

	if fileName == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "File name is required",
		})
		return
	}

	// Build full path
	var fullPath string
	if currentPath == "/" || currentPath == "" {
		fullPath = filepath.Join(server.FolderPath, fileName)
	} else {
		relativePath := strings.TrimPrefix(currentPath, "/")
		fullPath = filepath.Join(server.FolderPath, relativePath, fileName)
	}

	// Security check: ensure the path is within the server folder
	cleanPath := filepath.Clean(fullPath)
	if !strings.HasPrefix(cleanPath, server.FolderPath) {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied: path outside server directory",
		})
		return
	}

	// Check if file exists
	fileInfo, err := os.Stat(cleanPath)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "File not found",
		})
		return
	}

	if fileInfo.IsDir() {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Cannot write to directory",
		})
		return
	}

	// Write content to file
	err = ioutil.WriteFile(cleanPath, []byte(content), 0644)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to write file: " + err.Error(),
		})
		return
	}

	// Return success
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "File saved successfully",
		"name":    fileName,
	})
}