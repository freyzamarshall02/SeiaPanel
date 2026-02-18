package handlers

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"io/ioutil"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"seiapanel/middleware"
	"seiapanel/models"

	"github.com/gorilla/mux"
)

// FileInfo represents a file or directory information
type FileInfo struct {
	Name      string    `json:"name"`
	IsDir     bool      `json:"is_dir"`
	Size      int64     `json:"size"`
	ModTime   time.Time `json:"mod_time"`
	Extension string    `json:"extension"`
}

// ListDirectoryResponse represents the response for directory listing
type ListDirectoryResponse struct {
	CurrentPath string     `json:"current_path"`
	Files       []FileInfo `json:"files"`
	Error       string     `json:"error,omitempty"`
}

// FilesPage renders the file manager page
func FilesPage(w http.ResponseWriter, r *http.Request) {
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

	tmpl, err := template.ParseFiles("templates/files.html")
	if err != nil {
		http.Error(w, "Error loading template", http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"User":   user,
		"Server": server,
	}

	tmpl.Execute(w, data)
}

// ListFiles lists all files and directories in the current path
func ListFiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	// Get server
	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		json.NewEncoder(w).Encode(ListDirectoryResponse{
			Error: "Server not found",
		})
		return
	}

	// Get requested path from query parameter (relative to server folder)
	requestedPath := r.URL.Query().Get("path")
	if requestedPath == "" {
		requestedPath = "/"
	}

	// Build full path
	var fullPath string
	if requestedPath == "/" {
		fullPath = server.FolderPath
	} else {
		// Remove leading slash and join with server path
		relativePath := strings.TrimPrefix(requestedPath, "/")
		fullPath = filepath.Join(server.FolderPath, relativePath)
	}

	// Security check: ensure the path is within the server folder
	cleanPath := filepath.Clean(fullPath)
	if !strings.HasPrefix(cleanPath, server.FolderPath) {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(ListDirectoryResponse{
			Error: "Access denied: path outside server directory",
		})
		return
	}

	// Check if path exists and is a directory
	fileInfo, err := os.Stat(cleanPath)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(ListDirectoryResponse{
			Error: "Path not found",
		})
		return
	}

	if !fileInfo.IsDir() {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ListDirectoryResponse{
			Error: "Path is not a directory",
		})
		return
	}

	// Read directory contents
	entries, err := ioutil.ReadDir(cleanPath)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ListDirectoryResponse{
			Error: "Failed to read directory",
		})
		return
	}

	// Convert to FileInfo array
	files := make([]FileInfo, 0)
	for _, entry := range entries {
		// Skip hidden files (starting with .)
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		fileInfo := FileInfo{
			Name:    entry.Name(),
			IsDir:   entry.IsDir(),
			Size:    entry.Size(),
			ModTime: entry.ModTime(),
		}

		// Get file extension for files
		if !entry.IsDir() {
			fileInfo.Extension = strings.TrimPrefix(filepath.Ext(entry.Name()), ".")
		}

		files = append(files, fileInfo)
	}

	// Sort: directories first, then files, alphabetically
	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir && !files[j].IsDir {
			return true
		}
		if !files[i].IsDir && files[j].IsDir {
			return false
		}
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})

	// Return response
	json.NewEncoder(w).Encode(ListDirectoryResponse{
		CurrentPath: requestedPath,
		Files:       files,
	})
}

// NavigateFolder navigates to a specific folder
func NavigateFolder(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	// Get server
	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Server not found",
		})
		return
	}

	// Get current path and folder name from query parameters
	currentPath := r.URL.Query().Get("current_path")
	folderName := r.URL.Query().Get("folder")

	if folderName == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Folder name is required",
		})
		return
	}

	// Build new path
	var newPath string
	if currentPath == "/" || currentPath == "" {
		newPath = "/" + folderName
	} else {
		newPath = filepath.Join(currentPath, folderName)
	}

	// Security check: ensure the new path is within the server folder
	fullPath := filepath.Join(server.FolderPath, strings.TrimPrefix(newPath, "/"))
	cleanPath := filepath.Clean(fullPath)
	
	if !strings.HasPrefix(cleanPath, server.FolderPath) {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Access denied: path outside server directory",
		})
		return
	}

	// Check if path exists and is a directory
	fileInfo, err := os.Stat(cleanPath)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Folder not found",
		})
		return
	}

	if !fileInfo.IsDir() {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Path is not a directory",
		})
		return
	}

	// Return new path
	json.NewEncoder(w).Encode(map[string]string{
		"new_path": newPath,
	})
}

// CreateDirectory creates a new directory
func CreateDirectory(w http.ResponseWriter, r *http.Request) {
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
	dirName := r.FormValue("name")

	// Validate input
	if dirName == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Directory name is required",
		})
		return
	}

	// Build full path
	var fullPath string
	if currentPath == "/" || currentPath == "" {
		fullPath = filepath.Join(server.FolderPath, dirName)
	} else {
		relativePath := strings.TrimPrefix(currentPath, "/")
		fullPath = filepath.Join(server.FolderPath, relativePath, dirName)
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

	// Check if directory already exists
	if _, err := os.Stat(cleanPath); err == nil {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Directory already exists",
		})
		return
	}

	// Create directory
	if err := os.Mkdir(cleanPath, 0755); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to create directory: " + err.Error(),
		})
		return
	}

	// Return success
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Directory created successfully",
		"name":    dirName,
	})
}

// UploadFile uploads a file
func UploadFile(w http.ResponseWriter, r *http.Request) {
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

	// Parse multipart form (max 100MB)
	err = r.ParseMultipartForm(100 << 20)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to parse upload",
		})
		return
	}

	// Get uploaded file
	file, header, err := r.FormFile("file")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No file uploaded",
		})
		return
	}
	defer file.Close()

	// Get target path
	currentPath := r.FormValue("path")

	// Build full path
	var fullPath string
	if currentPath == "/" || currentPath == "" {
		fullPath = filepath.Join(server.FolderPath, header.Filename)
	} else {
		relativePath := strings.TrimPrefix(currentPath, "/")
		fullPath = filepath.Join(server.FolderPath, relativePath, header.Filename)
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

	// Create destination file
	dst, err := os.Create(cleanPath)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to create file: " + err.Error(),
		})
		return
	}
	defer dst.Close()

	// Copy uploaded file to destination
	_, err = io.Copy(dst, file)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to save file: " + err.Error(),
		})
		return
	}

	// Return success
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "File uploaded successfully",
		"filename": header.Filename,
		"size":     header.Size,
	})
}

// CreateNewFile creates a new empty file
func CreateNewFile(w http.ResponseWriter, r *http.Request) {
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
	fileName := r.FormValue("name")

	// Validate input
	if fileName == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "File name is required",
		})
		return
	}

	// Validate file has extension
	if !strings.Contains(fileName, ".") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "File name must include an extension",
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

	// Check if file already exists
	if _, err := os.Stat(cleanPath); err == nil {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "File already exists",
		})
		return
	}

	// Create empty file
	file, err := os.Create(cleanPath)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to create file: " + err.Error(),
		})
		return
	}
	file.Close()

	// Return success
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "File created successfully",
		"name":    fileName,
	})
}

// RenameFile renames a file or directory
func RenameFile(w http.ResponseWriter, r *http.Request) {
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
	oldName := r.FormValue("old_name")
	newName := r.FormValue("new_name")

	// Validate input
	if oldName == "" || newName == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Both old name and new name are required",
		})
		return
	}

	if oldName == newName {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "New name is the same as old name",
		})
		return
	}

	// Build old full path
	var oldFullPath string
	if currentPath == "/" || currentPath == "" {
		oldFullPath = filepath.Join(server.FolderPath, oldName)
	} else {
		relativePath := strings.TrimPrefix(currentPath, "/")
		oldFullPath = filepath.Join(server.FolderPath, relativePath, oldName)
	}

	// Build new full path
	var newFullPath string
	if currentPath == "/" || currentPath == "" {
		newFullPath = filepath.Join(server.FolderPath, newName)
	} else {
		relativePath := strings.TrimPrefix(currentPath, "/")
		newFullPath = filepath.Join(server.FolderPath, relativePath, newName)
	}

	// Security check: ensure both paths are within the server folder
	cleanOldPath := filepath.Clean(oldFullPath)
	cleanNewPath := filepath.Clean(newFullPath)
	
	if !strings.HasPrefix(cleanOldPath, server.FolderPath) || !strings.HasPrefix(cleanNewPath, server.FolderPath) {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied: path outside server directory",
		})
		return
	}

	// Check if old file/directory exists
	if _, err := os.Stat(cleanOldPath); os.IsNotExist(err) {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "File or directory not found",
		})
		return
	}

	// Check if new name already exists
	if _, err := os.Stat(cleanNewPath); err == nil {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "A file or directory with this name already exists",
		})
		return
	}

	// Rename the file/directory
	if err := os.Rename(cleanOldPath, cleanNewPath); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to rename: " + err.Error(),
		})
		return
	}

	// Return success
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Renamed successfully",
		"old_name": oldName,
		"new_name": newName,
	})
}

// MoveFiles moves selected files/folders to target directory
func MoveFiles(w http.ResponseWriter, r *http.Request) {
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

	sourcePath := r.FormValue("source_path")
	targetPath := r.FormValue("target_path")
	filesJSON := r.FormValue("files")

	// Validate input
	if sourcePath == "" || targetPath == "" || filesJSON == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Source path, target path, and files are required",
		})
		return
	}

	// Parse files array
	var files []string
	if err := json.Unmarshal([]byte(filesJSON), &files); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid files format",
		})
		return
	}

	if len(files) == 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No files to move",
		})
		return
	}

	// Check if moving to the same directory
	if sourcePath == targetPath {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Cannot move files to the same directory",
		})
		return
	}

	// Build full paths
	sourceFullPath := filepath.Join(server.FolderPath, strings.TrimPrefix(sourcePath, "/"))
	targetFullPath := filepath.Join(server.FolderPath, strings.TrimPrefix(targetPath, "/"))

	// Security check
	if !strings.HasPrefix(filepath.Clean(sourceFullPath), server.FolderPath) ||
		!strings.HasPrefix(filepath.Clean(targetFullPath), server.FolderPath) {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied: path outside server directory",
		})
		return
	}

	// Check if target directory exists
	targetInfo, err := os.Stat(targetFullPath)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Target directory not found",
		})
		return
	}

	if !targetInfo.IsDir() {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Target path is not a directory",
		})
		return
	}

	// Move each file
	movedCount := 0
	for _, fileName := range files {
		sourceFilePath := filepath.Join(sourceFullPath, fileName)
		targetFilePath := filepath.Join(targetFullPath, fileName)

		// Check if source exists
		if _, err := os.Stat(sourceFilePath); os.IsNotExist(err) {
			continue // Skip if source doesn't exist
		}

		// Check if target already exists
		if _, err := os.Stat(targetFilePath); err == nil {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "File '" + fileName + "' already exists in target directory",
			})
			return
		}

		// Move file/directory
		if err := os.Rename(sourceFilePath, targetFilePath); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to move '" + fileName + "': " + err.Error(),
			})
			return
		}

		movedCount++
	}

	// Return success
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Files moved successfully",
		"count":   movedCount,
	})
}

// CopyFiles copies (duplicates) selected files/folders to target directory
func CopyFiles(w http.ResponseWriter, r *http.Request) {
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

	sourcePath := r.FormValue("source_path")
	targetPath := r.FormValue("target_path")
	filesJSON := r.FormValue("files")

	// Validate input
	if sourcePath == "" || targetPath == "" || filesJSON == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Source path, target path, and files are required",
		})
		return
	}

	// Parse files array
	var files []string
	if err := json.Unmarshal([]byte(filesJSON), &files); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid files format",
		})
		return
	}

	if len(files) == 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No files to copy",
		})
		return
	}

	// Build full paths
	sourceFullPath := filepath.Join(server.FolderPath, strings.TrimPrefix(sourcePath, "/"))
	targetFullPath := filepath.Join(server.FolderPath, strings.TrimPrefix(targetPath, "/"))

	// Security check
	if !strings.HasPrefix(filepath.Clean(sourceFullPath), server.FolderPath) ||
		!strings.HasPrefix(filepath.Clean(targetFullPath), server.FolderPath) {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied: path outside server directory",
		})
		return
	}

	// Check if target directory exists
	targetInfo, err := os.Stat(targetFullPath)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Target directory not found",
		})
		return
	}

	if !targetInfo.IsDir() {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Target path is not a directory",
		})
		return
	}

	// Copy each file
	copiedCount := 0
	for _, fileName := range files {
		sourceFilePath := filepath.Join(sourceFullPath, fileName)
		targetFilePath := filepath.Join(targetFullPath, fileName)

		// Check if source exists
		sourceInfo, err := os.Stat(sourceFilePath)
		if os.IsNotExist(err) {
			continue // Skip if source doesn't exist
		}

		// Check if target already exists
		if _, err := os.Stat(targetFilePath); err == nil {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "File '" + fileName + "' already exists in target directory",
			})
			return
		}

		// Copy file or directory
		if sourceInfo.IsDir() {
			// Copy directory recursively
			if err := copyDir(sourceFilePath, targetFilePath); err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"success": false,
					"error":   "Failed to copy directory '" + fileName + "': " + err.Error(),
				})
				return
			}
		} else {
			// Copy file
			if err := copyFile(sourceFilePath, targetFilePath); err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"success": false,
					"error":   "Failed to copy file '" + fileName + "': " + err.Error(),
				})
				return
			}
		}

		copiedCount++
	}

	// Return success
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Files duplicated successfully",
		"count":   copiedCount,
	})
}

// copyFile copies a single file from src to dst
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	if err != nil {
		return err
	}

	// Copy file permissions
	sourceInfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	return os.Chmod(dst, sourceInfo.Mode())
}

// copyDir recursively copies a directory from src to dst
func copyDir(src, dst string) error {
	// Get source directory info
	sourceInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	// Create destination directory
	if err := os.MkdirAll(dst, sourceInfo.Mode()); err != nil {
		return err
	}

	// Read source directory
	entries, err := ioutil.ReadDir(src)
	if err != nil {
		return err
	}

	// Copy each entry
	for _, entry := range entries {
		sourcePath := filepath.Join(src, entry.Name())
		destPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			// Recursively copy subdirectory
			if err := copyDir(sourcePath, destPath); err != nil {
				return err
			}
		} else {
			// Copy file
			if err := copyFile(sourcePath, destPath); err != nil {
				return err
			}
		}
	}

	return nil
}

// DeleteFiles deletes selected files/folders (STUB)
// DeleteFiles deletes selected files and folders
func DeleteFiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	// Get server
	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Server not found",
		})
		return
	}

	// Parse form data
	if err := r.ParseForm(); err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid form data",
		})
		return
	}

	currentPath := r.FormValue("path")
	filesJSON := r.FormValue("files")

	// Parse files array
	var fileNames []string
	if err := json.Unmarshal([]byte(filesJSON), &fileNames); err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid files data",
		})
		return
	}

	if len(fileNames) == 0 {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No files selected",
		})
		return
	}

	// Build full path
	var fullPath string
	if currentPath == "/" || currentPath == "" {
		fullPath = server.FolderPath
	} else {
		relativePath := strings.TrimPrefix(currentPath, "/")
		fullPath = filepath.Join(server.FolderPath, relativePath)
	}

	// Validate path is within server directory
	if !strings.HasPrefix(fullPath, server.FolderPath) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid path",
		})
		return
	}

	// Delete each file/folder
	deletedCount := 0
	var errors []string

	for _, fileName := range fileNames {
		filePath := filepath.Join(fullPath, fileName)

		// Security check: validate path is within server directory
		if !strings.HasPrefix(filePath, server.FolderPath) {
			errors = append(errors, fmt.Sprintf("Invalid path: %s", fileName))
			continue
		}

		// Check if file/folder exists
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			errors = append(errors, fmt.Sprintf("Not found: %s", fileName))
			continue
		}

		// Delete file or folder (RemoveAll works for both)
		if err := os.RemoveAll(filePath); err != nil {
			errors = append(errors, fmt.Sprintf("Failed to delete %s: %v", fileName, err))
			continue
		}

		deletedCount++
	}

	// Prepare response
	if deletedCount > 0 {
		response := map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("Successfully deleted %d item(s)", deletedCount),
			"count":   deletedCount,
		}

		if len(errors) > 0 {
			response["partial"] = true
			response["errors"] = errors
		}

		json.NewEncoder(w).Encode(response)
	} else {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to delete files",
			"errors":  errors,
		})
	}
}

// ArchiveFiles creates an archive of selected files/folders (STUB)
// ArchiveFiles creates a tar.gz archive of selected files/folders
func ArchiveFiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	// Get server
	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Server not found",
		})
		return
	}

	// Parse form data
	if err := r.ParseForm(); err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid form data",
		})
		return
	}

	currentPath := r.FormValue("path")
	filesJSON := r.FormValue("files")

	// Parse files array
	var fileNames []string
	if err := json.Unmarshal([]byte(filesJSON), &fileNames); err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid files data",
		})
		return
	}

	if len(fileNames) == 0 {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No files selected",
		})
		return
	}

	// Build full path
	var fullPath string
	if currentPath == "/" || currentPath == "" {
		fullPath = server.FolderPath
	} else {
		relativePath := strings.TrimPrefix(currentPath, "/")
		fullPath = filepath.Join(server.FolderPath, relativePath)
	}

	// Validate path is within server directory
	if !strings.HasPrefix(fullPath, server.FolderPath) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid path",
		})
		return
	}

	// Generate random number for archive name
	randomNum, err := rand.Int(rand.Reader, big.NewInt(999999))
	if err != nil {
		randomNum = big.NewInt(int64(time.Now().Unix() % 999999))
	}

	archiveName := fmt.Sprintf("archived_%d.tar.gz", randomNum)
	archivePath := filepath.Join(fullPath, archiveName)

	// Create archive file
	archiveFile, err := os.Create(archivePath)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to create archive file",
		})
		return
	}
	defer archiveFile.Close()

	// Create gzip writer
	gzipWriter := gzip.NewWriter(archiveFile)
	defer gzipWriter.Close()

	// Create tar writer
	tarWriter := tar.NewWriter(gzipWriter)
	defer tarWriter.Close()

	// Add each file/folder to archive
	for _, fileName := range fileNames {
		sourcePath := filepath.Join(fullPath, fileName)

		// Check if file exists
		info, err := os.Stat(sourcePath)
		if err != nil {
			continue // Skip files that don't exist
		}

		// Add to archive (recursively if directory)
		if err := addToArchive(tarWriter, sourcePath, fileName, info); err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to add %s to archive", fileName),
			})
			return
		}
	}

	// Success response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Successfully created archive: %s", archiveName),
		"archive": archiveName,
		"count":   len(fileNames),
	})
}

// addToArchive recursively adds files/directories to tar archive
func addToArchive(tarWriter *tar.Writer, sourcePath string, nameInArchive string, info os.FileInfo) error {
	// Create tar header
	header, err := tar.FileInfoHeader(info, "")
	if err != nil {
		return err
	}

	// Set name in archive
	header.Name = nameInArchive

	// Write header
	if err := tarWriter.WriteHeader(header); err != nil {
		return err
	}

	// If it's a file, write contents
	if !info.IsDir() {
		file, err := os.Open(sourcePath)
		if err != nil {
			return err
		}
		defer file.Close()

		if _, err := io.Copy(tarWriter, file); err != nil {
			return err
		}
		return nil
	}

	// If it's a directory, recursively add contents
	entries, err := os.ReadDir(sourcePath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		entryPath := filepath.Join(sourcePath, entry.Name())
		entryInfo, err := entry.Info()
		if err != nil {
			continue
		}

		entryNameInArchive := filepath.Join(nameInArchive, entry.Name())
		if err := addToArchive(tarWriter, entryPath, entryNameInArchive, entryInfo); err != nil {
			return err
		}
	}

	return nil
}

// UnarchiveFile extracts an archive (tar.gz, zip, etc.) to the current directory
func UnarchiveFile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	// Get server
	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Server not found",
		})
		return
	}

	// Parse form data
	if err := r.ParseForm(); err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid form data",
		})
		return
	}

	currentPath := r.FormValue("path")
	fileName := r.FormValue("file")

	if fileName == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No file specified",
		})
		return
	}

	// Build full path
	var fullPath string
	if currentPath == "/" || currentPath == "" {
		fullPath = server.FolderPath
	} else {
		relativePath := strings.TrimPrefix(currentPath, "/")
		fullPath = filepath.Join(server.FolderPath, relativePath)
	}

	// Validate path is within server directory
	if !strings.HasPrefix(fullPath, server.FolderPath) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid path",
		})
		return
	}

	archivePath := filepath.Join(fullPath, fileName)

	// Check if archive exists
	if _, err := os.Stat(archivePath); os.IsNotExist(err) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Archive file not found",
		})
		return
	}

	// Detect archive type and extract
	var extractErr error
	if strings.HasSuffix(fileName, ".tar.gz") || strings.HasSuffix(fileName, ".tgz") {
		extractErr = extractTarGz(archivePath, fullPath)
	} else if strings.HasSuffix(fileName, ".tar") {
		extractErr = extractTar(archivePath, fullPath)
	} else if strings.HasSuffix(fileName, ".zip") {
		extractErr = extractZip(archivePath, fullPath)
	} else if strings.HasSuffix(fileName, ".gz") {
		extractErr = extractGz(archivePath, fullPath)
	} else {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Unsupported archive format (supported: .tar.gz, .tgz, .tar, .zip, .gz)",
		})
		return
	}

	if extractErr != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to extract archive: %v", extractErr),
		})
		return
	}

	// Success response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Successfully extracted: %s", fileName),
	})
}

// extractTarGz extracts a .tar.gz archive
func extractTarGz(archivePath, destPath string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()

	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		target := filepath.Join(destPath, header.Name)

		// Security check: prevent path traversal
		if !strings.HasPrefix(target, filepath.Clean(destPath)+string(os.PathSeparator)) {
			continue
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			// Create parent directory if needed
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}

			outFile, err := os.Create(target)
			if err != nil {
				return err
			}

			if _, err := io.Copy(outFile, tarReader); err != nil {
				outFile.Close()
				return err
			}
			outFile.Close()

			// Set file permissions
			if err := os.Chmod(target, os.FileMode(header.Mode)); err != nil {
				return err
			}
		}
	}

	return nil
}

// extractTar extracts a .tar archive
func extractTar(archivePath, destPath string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()

	tarReader := tar.NewReader(file)

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		target := filepath.Join(destPath, header.Name)

		// Security check: prevent path traversal
		if !strings.HasPrefix(target, filepath.Clean(destPath)+string(os.PathSeparator)) {
			continue
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			// Create parent directory if needed
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}

			outFile, err := os.Create(target)
			if err != nil {
				return err
			}

			if _, err := io.Copy(outFile, tarReader); err != nil {
				outFile.Close()
				return err
			}
			outFile.Close()

			// Set file permissions
			if err := os.Chmod(target, os.FileMode(header.Mode)); err != nil {
				return err
			}
		}
	}

	return nil
}

// extractZip extracts a .zip archive
func extractZip(archivePath, destPath string) error {
	zipReader, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer zipReader.Close()

	for _, file := range zipReader.File {
		target := filepath.Join(destPath, file.Name)

		// Security check: prevent path traversal
		if !strings.HasPrefix(target, filepath.Clean(destPath)+string(os.PathSeparator)) {
			continue
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
			continue
		}

		// Create parent directory if needed
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}

		// Open file in archive
		srcFile, err := file.Open()
		if err != nil {
			return err
		}

		// Create destination file
		outFile, err := os.Create(target)
		if err != nil {
			srcFile.Close()
			return err
		}

		// Copy contents
		if _, err := io.Copy(outFile, srcFile); err != nil {
			outFile.Close()
			srcFile.Close()
			return err
		}

		outFile.Close()
		srcFile.Close()

		// Set file permissions
		if err := os.Chmod(target, file.Mode()); err != nil {
			return err
		}
	}

	return nil
}

// extractGz extracts a .gz file (single file compression)
func extractGz(archivePath, destPath string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()

	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gzipReader.Close()

	// Output filename is the archive name without .gz extension
	outputName := strings.TrimSuffix(filepath.Base(archivePath), ".gz")
	outputPath := filepath.Join(destPath, outputName)

	outFile, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	if _, err := io.Copy(outFile, gzipReader); err != nil {
		return err
	}

	return nil
}

// DownloadFile streams a file to the client for download
func DownloadFile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	userID := middleware.GetUserID(r)

	// Get server
	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	// Get file path from query parameter
	currentPath := r.URL.Query().Get("path")
	fileName := r.URL.Query().Get("file")

	if fileName == "" {
		http.Error(w, "No file specified", http.StatusBadRequest)
		return
	}

	// Build full path
	var fullPath string
	if currentPath == "/" || currentPath == "" {
		fullPath = server.FolderPath
	} else {
		relativePath := strings.TrimPrefix(currentPath, "/")
		fullPath = filepath.Join(server.FolderPath, relativePath)
	}

	filePath := filepath.Join(fullPath, fileName)

	// Validate path is within server directory (security check)
	if !strings.HasPrefix(filePath, server.FolderPath) {
		http.Error(w, "Invalid file path", http.StatusForbidden)
		return
	}

	// Check if file exists
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to access file", http.StatusInternalServerError)
		}
		return
	}

	// Don't allow downloading directories
	if fileInfo.IsDir() {
		http.Error(w, "Cannot download directories (use archive instead)", http.StatusBadRequest)
		return
	}

	// Open file
	file, err := os.Open(filePath)
	if err != nil {
		http.Error(w, "Failed to open file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// Detect content type
	buffer := make([]byte, 512)
	_, err = file.Read(buffer)
	if err != nil && err != io.EOF {
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}
	contentType := http.DetectContentType(buffer)

	// Reset file pointer to beginning
	file.Seek(0, 0)

	// Set headers
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fileInfo.Size()))

	// Stream file to client
	_, err = io.Copy(w, file)
	if err != nil {
		// Can't send error response here as headers are already sent
		// Log error instead
		fmt.Printf("Error streaming file: %v\n", err)
	}
}