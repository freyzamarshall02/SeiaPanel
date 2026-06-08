package handlers

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"strconv"

	"seiapanel/middleware"
	"seiapanel/models"
	"seiapanel/services"

	"github.com/gorilla/mux"
)

// BackupsPage renders the backups page
func BackupsPage(w http.ResponseWriter, r *http.Request) {
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

	tmpl, err := template.ParseFiles("templates/backups.html")
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

// GetBackupSettings returns the backup settings for a server
func GetBackupSettings(w http.ResponseWriter, r *http.Request) {
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

	settings := server.GetBackupSettings()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    settings,
	})
}

// UpdateBackupSettings updates the backup settings for a server
func UpdateBackupSettings(w http.ResponseWriter, r *http.Request) {
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

	// Parse form data
	if err := r.ParseForm(); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Error parsing form",
		})
		return
	}

	backupPath := r.FormValue("backup_path")
	maxBackupsStr := r.FormValue("max_backups")

	// Validate inputs
	if backupPath == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Backup path is required",
		})
		return
	}

	maxBackups, err := strconv.Atoi(maxBackupsStr)
	if err != nil || maxBackups < 1 || maxBackups > 3 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Max backups must be between 1 and 3",
		})
		return
	}

	// Validate and create backup path if needed
	if err := services.ValidateBackupPath(backupPath); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Invalid backup path: %v", err),
		})
		return
	}

	// Update settings
	if err := server.UpdateBackupSettings(backupPath, maxBackups); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to update settings",
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Backup settings updated successfully",
		"data": map[string]interface{}{
			"backup_path": backupPath,
			"max_backups": maxBackups,
		},
	})
}

// ListBackups returns all backups for a server
func ListBackups(w http.ResponseWriter, r *http.Request) {
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

	backups, err := models.GetBackupsByServerID(server.ID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to retrieve backups",
		})
		return
	}

	// Format backups with human-readable sizes
	formattedBackups := make([]map[string]interface{}, 0)
	for _, backup := range backups {
		formattedBackups = append(formattedBackups, map[string]interface{}{
			"id":           backup.ID,
			"file_name":    backup.FileName,
			"file_size":    backup.FileSize,
			"size_display": services.FormatFileSize(backup.FileSize),
			"created_at":   backup.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"backups": formattedBackups,
	})
}

// CreateBackup creates a new backup for a server
func CreateBackup(w http.ResponseWriter, r *http.Request) {
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

	// Check if backup path is set
	if server.BackupPath == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Backup path not configured. Please set it in Settings first.",
		})
		return
	}

	// Rotate backups if needed (delete oldest if at limit)
	if err := services.RotateBackups(server.ID, server.MaxBackups); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to rotate backups: %v", err),
		})
		return
	}

	// Generate backup filename
	fileName := services.GenerateBackupFileName(server.Name)

	// Create backup
	backupPath, fileSize, err := services.CreateTarGzBackup(server.FolderPath, server.BackupPath, fileName)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to create backup: %v", err),
		})
		return
	}

	// Save backup record to database
	backup, err := models.CreateBackup(server.ID, fileName, backupPath, fileSize)
	if err != nil {
		// Clean up backup file if database insert fails
		os.Remove(backupPath)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to save backup record",
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Backup created successfully",
		"backup": map[string]interface{}{
			"id":           backup.ID,
			"file_name":    backup.FileName,
			"file_size":    backup.FileSize,
			"size_display": services.FormatFileSize(backup.FileSize),
			"created_at":   backup.CreatedAt.Format("2006-01-02 15:04:05"),
		},
	})
}

// DeleteBackup deletes a backup
func DeleteBackup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	backupIDStr := vars["id"]
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

	// Parse backup ID
	backupID, err := strconv.ParseUint(backupIDStr, 10, 32)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid backup ID",
		})
		return
	}

	// Get backup
	backup, err := models.GetBackupByID(uint(backupID))
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Backup not found",
		})
		return
	}

	// Verify backup belongs to this server
	if backup.ServerID != server.ID {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	// Delete file from disk
	if err := services.DeleteBackupFile(backup.FilePath); err != nil {
		// Log error but continue (file might already be deleted)
		fmt.Printf("Warning: failed to delete backup file: %v\n", err)
	}

	// Delete database record
	if err := backup.Delete(); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to delete backup record",
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Backup deleted successfully",
	})
}

// DownloadBackup streams a backup file for download
func DownloadBackup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverName := vars["name"]
	backupIDStr := vars["id"]
	userID := middleware.GetUserID(r)

	// Get server
	server, err := models.GetServerByName(serverName, userID)
	if err != nil {
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	// Parse backup ID
	backupID, err := strconv.ParseUint(backupIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid backup ID", http.StatusBadRequest)
		return
	}

	// Get backup
	backup, err := models.GetBackupByID(uint(backupID))
	if err != nil {
		http.Error(w, "Backup not found", http.StatusNotFound)
		return
	}

	// Verify backup belongs to this server
	if backup.ServerID != server.ID {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	// Check if file exists
	if _, err := os.Stat(backup.FilePath); os.IsNotExist(err) {
		http.Error(w, "Backup file not found on disk", http.StatusNotFound)
		return
	}

	// Open file
	file, err := os.Open(backup.FilePath)
	if err != nil {
		http.Error(w, "Failed to open backup file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// Set headers for download
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", backup.FileName))
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", backup.FileSize))

	// Stream file to client
	if _, err := io.Copy(w, file); err != nil {
		fmt.Printf("Error streaming backup file: %v\n", err)
	}
}

// RestoreBackup restores a server from a backup
func RestoreBackup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	backupIDStr := vars["id"]
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

	// Check if server is running
	if server.Status == "online" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Cannot restore while server is running. Please stop the server first.",
		})
		return
	}

	// Parse backup ID
	backupID, err := strconv.ParseUint(backupIDStr, 10, 32)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid backup ID",
		})
		return
	}

	// Get backup
	backup, err := models.GetBackupByID(uint(backupID))
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Backup not found",
		})
		return
	}

	// Verify backup belongs to this server
	if backup.ServerID != server.ID {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	// Check if backup file exists
	if _, err := os.Stat(backup.FilePath); os.IsNotExist(err) {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Backup file not found on disk",
		})
		return
	}

	// Perform restore operation
	if err := services.RestoreBackupFromArchive(backup.FilePath, server.FolderPath); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to restore backup: %v", err),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Server restored successfully from backup: %s", backup.FileName),
	})
}