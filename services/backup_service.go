package services

import (
	"archive/tar"
	"compress/gzip"
	"crypto/rand"
	"fmt"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"seiapanel/models"
	"time"
)

// BackupService handles backup operations
type BackupService struct{}

// GenerateRandomID generates a random 4-digit ID
func GenerateRandomID() string {
	randomNum, err := rand.Int(rand.Reader, big.NewInt(9999))
	if err != nil {
		// Fallback to timestamp-based random
		randomNum = big.NewInt(int64(time.Now().Unix() % 9999))
	}
	return fmt.Sprintf("%04d", randomNum.Int64())
}

// GenerateBackupFileName generates a backup filename in format: {ServerName}_{YYYYMMDD}_{RandomID}.tar.gz
func GenerateBackupFileName(serverName string) string {
	now := time.Now()
	dateStr := now.Format("20060102") // YYYYMMDD format
	randomID := GenerateRandomID()
	return fmt.Sprintf("%s_%s_%s.tar.gz", serverName, dateStr, randomID)
}

// CreateTarGzBackup creates a tar.gz backup of the server folder
func CreateTarGzBackup(sourcePath, backupPath, fileName string) (string, int64, error) {
	// Ensure backup directory exists
	if err := os.MkdirAll(backupPath, 0755); err != nil {
		return "", 0, fmt.Errorf("failed to create backup directory: %w", err)
	}

	// Full backup file path
	fullBackupPath := filepath.Join(backupPath, fileName)

	// Create backup file
	backupFile, err := os.Create(fullBackupPath)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create backup file: %w", err)
	}
	defer backupFile.Close()

	// Create gzip writer
	gzipWriter := gzip.NewWriter(backupFile)
	defer gzipWriter.Close()

	// Create tar writer
	tarWriter := tar.NewWriter(gzipWriter)
	defer tarWriter.Close()

	// Walk through source directory and add files to archive
	err = filepath.Walk(sourcePath, func(file string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip if it's the source directory itself
		if file == sourcePath {
			return nil
		}

		// Create tar header
		header, err := tar.FileInfoHeader(fi, "")
		if err != nil {
			return err
		}

		// Get relative path
		relPath, err := filepath.Rel(sourcePath, file)
		if err != nil {
			return err
		}
		header.Name = relPath

		// Write header
		if err := tarWriter.WriteHeader(header); err != nil {
			return err
		}

		// If it's a file, write its content
		if !fi.IsDir() {
			fileToArchive, err := os.Open(file)
			if err != nil {
				return err
			}
			defer fileToArchive.Close()

			if _, err := io.Copy(tarWriter, fileToArchive); err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return "", 0, fmt.Errorf("failed to create tar.gz archive: %w", err)
	}

	// Get file size
	fileInfo, err := os.Stat(fullBackupPath)
	if err != nil {
		return "", 0, fmt.Errorf("failed to get backup file size: %w", err)
	}

	return fullBackupPath, fileInfo.Size(), nil
}

// RotateBackups deletes the oldest backup when the limit is reached
func RotateBackups(serverID uint, maxBackups int) error {
	// Count current backups
	count, err := models.CountBackups(serverID)
	if err != nil {
		return fmt.Errorf("failed to count backups: %w", err)
	}

	// If we've reached the limit, delete the oldest backup
	if int(count) >= maxBackups {
		oldestBackup, err := models.GetOldestBackup(serverID)
		if err != nil {
			return fmt.Errorf("failed to get oldest backup: %w", err)
		}

		// Delete the actual file
		if err := os.Remove(oldestBackup.FilePath); err != nil {
			// Log error but continue (file might already be deleted)
			fmt.Printf("Warning: failed to delete backup file %s: %v\n", oldestBackup.FilePath, err)
		}

		// Delete database record
		if err := oldestBackup.Delete(); err != nil {
			return fmt.Errorf("failed to delete backup record: %w", err)
		}
	}

	return nil
}

// DeleteBackupFile deletes a backup file from disk
func DeleteBackupFile(filePath string) error {
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("failed to delete backup file: %w", err)
	}
	return nil
}

// GetBackupSize returns the size of a backup file
func GetBackupSize(filePath string) (int64, error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return 0, fmt.Errorf("failed to get file info: %w", err)
	}
	return fileInfo.Size(), nil
}

// ValidateBackupPath checks if the backup path is valid and accessible
func ValidateBackupPath(backupPath string) error {
	// Check if path exists
	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		// Try to create it
		if err := os.MkdirAll(backupPath, 0755); err != nil {
			return fmt.Errorf("backup path does not exist and cannot be created: %w", err)
		}
	}

	// Check if path is writable
	testFile := filepath.Join(backupPath, ".write_test")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		return fmt.Errorf("backup path is not writable: %w", err)
	}
	os.Remove(testFile)

	return nil
}

// FormatFileSize formats bytes to human-readable size
func FormatFileSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// RestoreBackupFromArchive restores a server directory from a tar.gz backup
func RestoreBackupFromArchive(backupFilePath, serverFolderPath string) error {
	// Step 1: Validate backup file exists
	if _, err := os.Stat(backupFilePath); os.IsNotExist(err) {
		return fmt.Errorf("backup file not found: %w", err)
	}

	// Step 2: Validate server folder exists
	if _, err := os.Stat(serverFolderPath); os.IsNotExist(err) {
		return fmt.Errorf("server folder not found: %w", err)
	}

	// Step 3: Delete all contents inside server folder (but keep the folder itself)
	if err := clearDirectory(serverFolderPath); err != nil {
		return fmt.Errorf("failed to clear server directory: %w", err)
	}

	// Step 4: Extract backup to server folder
	if err := extractTarGzBackup(backupFilePath, serverFolderPath); err != nil {
		return fmt.Errorf("failed to extract backup: %w", err)
	}

	return nil
}

// clearDirectory removes all contents of a directory but keeps the directory itself
func clearDirectory(dirPath string) error {
	// Read directory contents
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return fmt.Errorf("failed to read directory: %w", err)
	}

	// Delete each entry
	for _, entry := range entries {
		entryPath := filepath.Join(dirPath, entry.Name())
		if err := os.RemoveAll(entryPath); err != nil {
			return fmt.Errorf("failed to remove %s: %w", entryPath, err)
		}
	}

	return nil
}

// extractTarGzBackup extracts a tar.gz backup to the specified destination
func extractTarGzBackup(backupFilePath, destPath string) error {
	// Open backup file
	file, err := os.Open(backupFilePath)
	if err != nil {
		return fmt.Errorf("failed to open backup file: %w", err)
	}
	defer file.Close()

	// Create gzip reader
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzipReader.Close()

	// Create tar reader
	tarReader := tar.NewReader(gzipReader)

	// Extract each file
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break // End of archive
		}
		if err != nil {
			return fmt.Errorf("failed to read tar header: %w", err)
		}

		// Build target path
		target := filepath.Join(destPath, header.Name)

		// Security check: prevent path traversal
		if !filepath.HasPrefix(filepath.Clean(target), filepath.Clean(destPath)) {
			return fmt.Errorf("invalid file path in archive: %s", header.Name)
		}

		// Handle different file types
		switch header.Typeflag {
		case tar.TypeDir:
			// Create directory
			if err := os.MkdirAll(target, 0755); err != nil {
				return fmt.Errorf("failed to create directory %s: %w", target, err)
			}

		case tar.TypeReg:
			// Create parent directory if needed
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return fmt.Errorf("failed to create parent directory for %s: %w", target, err)
			}

			// Create file
			outFile, err := os.Create(target)
			if err != nil {
				return fmt.Errorf("failed to create file %s: %w", target, err)
			}

			// Copy file contents
			if _, err := io.Copy(outFile, tarReader); err != nil {
				outFile.Close()
				return fmt.Errorf("failed to write file %s: %w", target, err)
			}
			outFile.Close()

			// Set file permissions
			if err := os.Chmod(target, os.FileMode(header.Mode)); err != nil {
				return fmt.Errorf("failed to set permissions for %s: %w", target, err)
			}
		}
	}

	return nil
}