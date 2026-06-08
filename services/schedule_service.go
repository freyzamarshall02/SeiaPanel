package services

import (
	"fmt"
	"log"
	"seiapanel/models"
	"sync"

	"github.com/robfig/cron/v3"
)

// ScheduleService manages scheduled tasks
type ScheduleService struct {
	cron      *cron.Cron
	schedules map[uint]cron.EntryID // maps schedule ID to cron entry ID
	mu        sync.RWMutex
}

var (
	scheduleService *ScheduleService
	serviceOnce     sync.Once
)

// InitScheduler initializes the schedule service and starts the cron scheduler
func InitScheduler() {
	serviceOnce.Do(func() {
		scheduleService = &ScheduleService{
			cron:      cron.New(),
			schedules: make(map[uint]cron.EntryID),
		}

		// Start the cron scheduler
		scheduleService.cron.Start()
		log.Println("✅ Schedule service initialized and started")

		// Load all enabled schedules from database
		if err := scheduleService.LoadAllSchedules(); err != nil {
			log.Printf("⚠️  Warning: Failed to load schedules: %v", err)
		}
	})
}

// GetScheduleService returns the singleton schedule service instance
func GetScheduleService() *ScheduleService {
	return scheduleService
}

// LoadAllSchedules loads all enabled schedules from the database
func (s *ScheduleService) LoadAllSchedules() error {
	schedules, err := models.GetAllEnabledSchedules()
	if err != nil {
		return fmt.Errorf("failed to get enabled schedules: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, schedule := range schedules {
		if err := s.addScheduleInternal(schedule); err != nil {
			log.Printf("⚠️  Failed to add schedule %d (%s): %v", schedule.ID, schedule.Name, err)
		} else {
			log.Printf("✅ Loaded schedule: %s (ID: %d)", schedule.Name, schedule.ID)
		}
	}

	return nil
}

// AddSchedule adds a schedule to the cron scheduler
func (s *ScheduleService) AddSchedule(schedule models.Schedule) error {
	if !schedule.Enabled {
		return nil // Don't add disabled schedules
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	return s.addScheduleInternal(schedule)
}

// addScheduleInternal adds a schedule without locking (internal use only)
func (s *ScheduleService) addScheduleInternal(schedule models.Schedule) error {
	// Check if schedule already exists
	if _, exists := s.schedules[schedule.ID]; exists {
		return fmt.Errorf("schedule %d already exists in cron", schedule.ID)
	}

	// Get cron expression
	cronExpr := schedule.GetCronExpression()

	// Add to cron scheduler
	entryID, err := s.cron.AddFunc(cronExpr, func() {
		s.executeSchedule(schedule)
	})

	if err != nil {
		return fmt.Errorf("failed to add cron job: %w", err)
	}

	// Store entry ID
	s.schedules[schedule.ID] = entryID

	log.Printf("✅ Added schedule to cron: %s (ID: %d, Cron: %s)", schedule.Name, schedule.ID, cronExpr)
	return nil
}

// RemoveSchedule removes a schedule from the cron scheduler
func (s *ScheduleService) RemoveSchedule(scheduleID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	entryID, exists := s.schedules[scheduleID]
	if !exists {
		return nil // Already removed or never added
	}

	// Remove from cron
	s.cron.Remove(entryID)

	// Remove from map
	delete(s.schedules, scheduleID)

	log.Printf("✅ Removed schedule from cron: ID %d", scheduleID)
	return nil
}

// UpdateSchedule updates a schedule in the cron scheduler
func (s *ScheduleService) UpdateSchedule(schedule models.Schedule) error {
	// Remove old schedule
	if err := s.RemoveSchedule(schedule.ID); err != nil {
		return err
	}

	// Add new schedule if enabled
	if schedule.Enabled {
		return s.AddSchedule(schedule)
	}

	return nil
}

// ExecuteScheduleManually executes a schedule immediately (manual trigger)
func (s *ScheduleService) ExecuteScheduleManually(schedule models.Schedule) {
	log.Printf("🎯 Manual execution triggered for schedule: %s (ID: %d)", schedule.Name, schedule.ID)
	s.executeSchedule(schedule)
}

// executeSchedule executes the action for a schedule
func (s *ScheduleService) executeSchedule(schedule models.Schedule) {
	log.Printf("⏰ Executing schedule: %s (ID: %d, Action: %s)", schedule.Name, schedule.ID, schedule.Action)

	// Get the server
	server, err := models.GetServerByID(schedule.ServerID)
	if err != nil {
		log.Printf("❌ Schedule %d: Failed to get server: %v", schedule.ID, err)
		return
	}

	// Execute action based on type
	switch schedule.Action {
	case "send_command":
		s.executeSendCommand(server, schedule)
	case "start_server":
		s.executeStartServer(server, schedule)
	case "restart_server":
		s.executeRestartServer(server, schedule)
	case "stop_server":
		s.executeStopServer(server, schedule)
	case "backup":
		s.executeBackup(server, schedule)
	default:
		log.Printf("❌ Schedule %d: Unknown action: %s", schedule.ID, schedule.Action)
	}
}

// executeSendCommand sends a command to the server
func (s *ScheduleService) executeSendCommand(server *models.Server, schedule models.Schedule) {
	// Check if server is running
	if !IsServerRunning(server) {
		log.Printf("⚠️  Schedule %d: Server %s is offline, skipping command", schedule.ID, server.Name)
		return
	}

	// Send command
	if err := SendCommand(server, schedule.Command); err != nil {
		log.Printf("❌ Schedule %d: Failed to send command to %s: %v", schedule.ID, server.Name, err)
		return
	}

	log.Printf("✅ Schedule %d: Command sent to %s: %s", schedule.ID, server.Name, schedule.Command)
}

// executeStartServer starts the server
func (s *ScheduleService) executeStartServer(server *models.Server, schedule models.Schedule) {
	// Check if server is already running
	if IsServerRunning(server) {
		log.Printf("⚠️  Schedule %d: Server %s is already online, skipping start", schedule.ID, server.Name)
		return
	}

	// Start server
	if err := StartServer(server); err != nil {
		log.Printf("❌ Schedule %d: Failed to start server %s: %v", schedule.ID, server.Name, err)
		return
	}

	log.Printf("✅ Schedule %d: Started server %s", schedule.ID, server.Name)
}

// executeRestartServer restarts the server
func (s *ScheduleService) executeRestartServer(server *models.Server, schedule models.Schedule) {
	// Check if server is running
	if !IsServerRunning(server) {
		log.Printf("⚠️  Schedule %d: Server %s is offline, skipping restart", schedule.ID, server.Name)
		return
	}

	// Restart server
	if err := RestartServer(server); err != nil {
		log.Printf("❌ Schedule %d: Failed to restart server %s: %v", schedule.ID, server.Name, err)
		return
	}

	log.Printf("✅ Schedule %d: Restarted server %s", schedule.ID, server.Name)
}

// executeStopServer stops the server
func (s *ScheduleService) executeStopServer(server *models.Server, schedule models.Schedule) {
	// Check if server is running
	if !IsServerRunning(server) {
		log.Printf("⚠️  Schedule %d: Server %s is already offline, skipping stop", schedule.ID, server.Name)
		return
	}

	// Stop server
	if err := StopServer(server); err != nil {
		log.Printf("❌ Schedule %d: Failed to stop server %s: %v", schedule.ID, server.Name, err)
		return
	}

	log.Printf("✅ Schedule %d: Stopped server %s", schedule.ID, server.Name)
}

// executeBackup creates a backup of the server
func (s *ScheduleService) executeBackup(server *models.Server, schedule models.Schedule) {
	// Check if backup path is configured
	if server.BackupPath == "" {
		log.Printf("⚠️  Schedule %d: Server %s has no backup path configured, skipping backup", schedule.ID, server.Name)
		return
	}

	// Rotate backups if needed
	if err := RotateBackups(server.ID, server.MaxBackups); err != nil {
		log.Printf("❌ Schedule %d: Failed to rotate backups for %s: %v", schedule.ID, server.Name, err)
		return
	}

	// Generate backup filename
	fileName := GenerateBackupFileName(server.Name)

	// Create backup
	backupFilePath, fileSize, err := CreateTarGzBackup(server.FolderPath, server.BackupPath, fileName)
	if err != nil {
		log.Printf("❌ Schedule %d: Failed to create backup for %s: %v", schedule.ID, server.Name, err)
		return
	}

	// Save backup record to database
	if _, err := models.CreateBackup(server.ID, fileName, backupFilePath, fileSize); err != nil {
		log.Printf("❌ Schedule %d: Failed to save backup record for %s: %v", schedule.ID, server.Name, err)
		return
	}

	log.Printf("✅ Schedule %d: Backup created for %s: %s", schedule.ID, server.Name, fileName)
}