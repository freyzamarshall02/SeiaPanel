package models

import (
	"fmt"
	"time"
)

// Server represents a Minecraft server
type Server struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	Name           string     `gorm:"unique;not null" json:"name"`
	FolderPath     string     `gorm:"not null" json:"folder_path"`
	StartupCommand string     `gorm:"not null" json:"startup_command"`
	Status         string     `gorm:"default:'offline'" json:"status"` // online, offline
	StartedAt      *time.Time `json:"started_at"`
	BackupPath     string     `gorm:"default:''" json:"backup_path"`        // Backup directory path
	MaxBackups     int        `gorm:"default:1" json:"max_backups"`         // Max number of backups (default 1, max 3)
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	UserID         uint       `gorm:"not null" json:"user_id"`
}

// CreateServer creates a new server entry
func CreateServer(name, folderPath, startupCommand string, userID uint) (*Server, error) {
	server := &Server{
		Name:           name,
		FolderPath:     folderPath,
		StartupCommand: startupCommand,
		Status:         "offline",
		MaxBackups:     1, // Default value
		BackupPath:     "", // Empty by default
		UserID:         userID,
	}

	if err := DB.Create(server).Error; err != nil {
		return nil, err
	}

	return server, nil
}

// GetServerByID retrieves a server by ID
func GetServerByID(id uint) (*Server, error) {
	var server Server
	if err := DB.First(&server, id).Error; err != nil {
		return nil, err
	}
	return &server, nil
}

// GetServerByName retrieves a server by name
func GetServerByName(name string, userID uint) (*Server, error) {
	var server Server
	if err := DB.Where("name = ? AND user_id = ?", name, userID).First(&server).Error; err != nil {
		return nil, err
	}
	return &server, nil
}

// GetServersByUserID retrieves all servers for a user
func GetServersByUserID(userID uint) ([]Server, error) {
	var servers []Server
	if err := DB.Where("user_id = ?", userID).Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}

// UpdateStartupCommand updates the server's startup command
func (s *Server) UpdateStartupCommand(command string) error {
	s.StartupCommand = command
	return DB.Save(s).Error
}

// UpdateBackupSettings updates the server's backup settings
func (s *Server) UpdateBackupSettings(backupPath string, maxBackups int) error {
	// Validate maxBackups (1-3)
	if maxBackups < 1 {
		maxBackups = 1
	}
	if maxBackups > 3 {
		maxBackups = 3
	}

	s.BackupPath = backupPath
	s.MaxBackups = maxBackups
	return DB.Save(s).Error
}

// GetBackupSettings returns the backup settings for the server
func (s *Server) GetBackupSettings() map[string]interface{} {
	return map[string]interface{}{
		"backup_path": s.BackupPath,
		"max_backups": s.MaxBackups,
	}
}

// SetStatus updates the server's status
func (s *Server) SetStatus(status string) error {
	s.Status = status
	if status == "online" {
		now := time.Now()
		s.StartedAt = &now
	} else {
		s.StartedAt = nil
	}
	return DB.Save(s).Error
}

// GetUptime returns the server uptime duration
func (s *Server) GetUptime() time.Duration {
	if s.Status == "online" && s.StartedAt != nil {
		return time.Since(*s.StartedAt)
	}
	return 0
}

// FormatUptime returns formatted uptime string (e.g., "9d 19h 8m 30s" or "0h 0m 5s")
func (s *Server) FormatUptime() string {
	if s.Status != "online" {
		return "Offline"
	}

	uptime := s.GetUptime()
	
	days := int(uptime.Hours() / 24)
	hours := int(uptime.Hours()) % 24
	minutes := int(uptime.Minutes()) % 60
	seconds := int(uptime.Seconds()) % 60

	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm %ds", days, hours, minutes, seconds)
	} else {
		return fmt.Sprintf("%dh %dm %ds", hours, minutes, seconds)
	}
}

func formatDuration(d, h, m int) string {
	return fmt.Sprintf("%dd %dh %dm", d, h, m)
}

func formatDurationHM(h, m int) string {
	return fmt.Sprintf("%dh %dm", h, m)
}

func formatDurationM(m int) string {
	return fmt.Sprintf("%dm", m)
}

// DeleteServer deletes a server
func (s *Server) Delete() error {
	return DB.Delete(s).Error
}