package main

import (
	"log"
	"net/http"
	"seiapanel/config"
	"seiapanel/handlers"
	"seiapanel/middleware"
	"seiapanel/models"
	"seiapanel/services"

	"github.com/gorilla/mux"
)

func main() {
	// Initialize database
	models.InitDatabase()

	// Initialize configuration
	config.Init()

	// Initialize schedule service
	services.InitScheduler()

	// Create router
	r := mux.NewRouter()

	// Serve static files
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	// Public routes (no authentication required)
	r.HandleFunc("/", handlers.LoginPage).Methods("GET")
	r.HandleFunc("/login", handlers.Login).Methods("POST")
	r.HandleFunc("/register", handlers.RegisterPage).Methods("GET")
	r.HandleFunc("/register", handlers.Register).Methods("POST")

	// Protected routes (authentication required)
	protected := r.PathPrefix("/").Subrouter()
	protected.Use(middleware.AuthMiddleware)

	// Dashboard
	protected.HandleFunc("/dashboard", handlers.Dashboard).Methods("GET")

	// Account management
	protected.HandleFunc("/account", handlers.AccountPage).Methods("GET")
	protected.HandleFunc("/account/update-username", handlers.UpdateUsername).Methods("POST")
	protected.HandleFunc("/account/update-password", handlers.UpdatePassword).Methods("POST")

	// Resource monitoring
	protected.HandleFunc("/resource", handlers.ResourcePage).Methods("GET")
	protected.HandleFunc("/api/system/stats", handlers.GetSystemStats).Methods("GET")

	// Settings
	protected.HandleFunc("/settings", handlers.SettingsPage).Methods("GET")
	protected.HandleFunc("/settings/update-path", handlers.UpdateServerPath).Methods("POST")

	// Server management
	protected.HandleFunc("/server/{name}", handlers.ServerConsolePage).Methods("GET")
	protected.HandleFunc("/server/{name}/start", handlers.StartServer).Methods("POST")
	protected.HandleFunc("/server/{name}/stop", handlers.StopServer).Methods("POST")
	protected.HandleFunc("/server/{name}/restart", handlers.RestartServer).Methods("POST")
	protected.HandleFunc("/server/{name}/command", handlers.SendCommand).Methods("POST")
	protected.HandleFunc("/server/{name}/logs", handlers.GetLogs).Methods("GET")
	protected.HandleFunc("/server/{name}/stats", handlers.GetServerStats).Methods("GET")
	protected.HandleFunc("/server/{name}/ws", handlers.ConsoleWebSocket).Methods("GET")

	// Startup management
	protected.HandleFunc("/server/{name}/startup", handlers.StartupPage).Methods("GET")
	protected.HandleFunc("/server/{name}/startup/update", handlers.UpdateStartup).Methods("POST")

	// Schedule management
	protected.HandleFunc("/server/{name}/schedule", handlers.SchedulePage).Methods("GET")
	protected.HandleFunc("/server/{name}/schedule/list", handlers.ListSchedules).Methods("GET")
	protected.HandleFunc("/server/{name}/schedule/create", handlers.CreateSchedule).Methods("POST")
	protected.HandleFunc("/server/{name}/schedule/{id}", handlers.GetSchedule).Methods("GET")
	protected.HandleFunc("/server/{name}/schedule/{id}/update", handlers.UpdateSchedule).Methods("POST")
	protected.HandleFunc("/server/{name}/schedule/{id}/delete", handlers.DeleteSchedule).Methods("DELETE")
	protected.HandleFunc("/server/{name}/schedule/{id}/toggle", handlers.ToggleSchedule).Methods("POST")
	protected.HandleFunc("/server/{name}/schedule/{id}/execute", handlers.ExecuteSchedule).Methods("POST")

	// Backups management
	protected.HandleFunc("/server/{name}/backups", handlers.BackupsPage).Methods("GET")
	protected.HandleFunc("/server/{name}/backups/settings", handlers.GetBackupSettings).Methods("GET")
	protected.HandleFunc("/server/{name}/backups/settings", handlers.UpdateBackupSettings).Methods("POST")
	protected.HandleFunc("/server/{name}/backups/list", handlers.ListBackups).Methods("GET")
	protected.HandleFunc("/server/{name}/backups/create", handlers.CreateBackup).Methods("POST")
	protected.HandleFunc("/server/{name}/backups/{id}", handlers.DeleteBackup).Methods("DELETE")
	protected.HandleFunc("/server/{name}/backups/download/{id}", handlers.DownloadBackup).Methods("GET")
	protected.HandleFunc("/server/{name}/backups/restore/{id}", handlers.RestoreBackup).Methods("POST")

	// File Manager
	protected.HandleFunc("/server/{name}/files", handlers.FilesPage).Methods("GET")
	protected.HandleFunc("/server/{name}/files/list", handlers.ListFiles).Methods("GET")
	protected.HandleFunc("/server/{name}/files/navigate", handlers.NavigateFolder).Methods("GET")
	
	// File Manager Operations
	protected.HandleFunc("/server/{name}/files/create-directory", handlers.CreateDirectory).Methods("POST")
	protected.HandleFunc("/server/{name}/files/upload", handlers.UploadFile).Methods("POST")
	protected.HandleFunc("/server/{name}/files/create-file", handlers.CreateNewFile).Methods("POST")
	protected.HandleFunc("/server/{name}/files/read", handlers.ReadFile).Methods("GET")
	protected.HandleFunc("/server/{name}/files/write", handlers.WriteFile).Methods("POST")
	protected.HandleFunc("/server/{name}/files/rename", handlers.RenameFile).Methods("POST")
	protected.HandleFunc("/server/{name}/files/delete", handlers.DeleteFiles).Methods("POST")
	protected.HandleFunc("/server/{name}/files/archive", handlers.ArchiveFiles).Methods("POST")
	protected.HandleFunc("/server/{name}/files/unarchive", handlers.UnarchiveFile).Methods("POST")
	protected.HandleFunc("/server/{name}/files/copy", handlers.CopyFiles).Methods("POST")
	protected.HandleFunc("/server/{name}/files/move", handlers.MoveFiles).Methods("POST")
	protected.HandleFunc("/server/{name}/files/download", handlers.DownloadFile).Methods("GET")

	// Logout
	protected.HandleFunc("/logout", handlers.Logout).Methods("GET")

	// Start server
	log.Println("🚀 Seia Panel starting on http://0.0.0.0:6767")
	log.Fatal(http.ListenAndServe(":6767", r))
}