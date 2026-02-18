package models

import (
	"time"
)

// Backup represents a server backup
type Backup struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ServerID  uint      `gorm:"not null" json:"server_id"`
	FileName  string    `gorm:"not null" json:"file_name"`
	FilePath  string    `gorm:"not null" json:"file_path"`
	FileSize  int64     `json:"file_size"` // Size in bytes
	CreatedAt time.Time `json:"created_at"`
}

// CreateBackup creates a new backup record
func CreateBackup(serverID uint, fileName, filePath string, fileSize int64) (*Backup, error) {
	backup := &Backup{
		ServerID: serverID,
		FileName: fileName,
		FilePath: filePath,
		FileSize: fileSize,
	}

	if err := DB.Create(backup).Error; err != nil {
		return nil, err
	}

	return backup, nil
}

// GetBackupsByServerID retrieves all backups for a specific server
func GetBackupsByServerID(serverID uint) ([]Backup, error) {
	var backups []Backup
	if err := DB.Where("server_id = ?", serverID).Order("created_at DESC").Find(&backups).Error; err != nil {
		return nil, err
	}
	return backups, nil
}

// GetBackupByID retrieves a backup by its ID
func GetBackupByID(id uint) (*Backup, error) {
	var backup Backup
	if err := DB.First(&backup, id).Error; err != nil {
		return nil, err
	}
	return &backup, nil
}

// DeleteBackup deletes a backup record and its file
func (b *Backup) Delete() error {
	return DB.Delete(b).Error
}

// GetOldestBackup gets the oldest backup for a server
func GetOldestBackup(serverID uint) (*Backup, error) {
	var backup Backup
	if err := DB.Where("server_id = ?", serverID).Order("created_at ASC").First(&backup).Error; err != nil {
		return nil, err
	}
	return &backup, nil
}

// CountBackups counts total backups for a server
func CountBackups(serverID uint) (int64, error) {
	var count int64
	if err := DB.Model(&Backup{}).Where("server_id = ?", serverID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}