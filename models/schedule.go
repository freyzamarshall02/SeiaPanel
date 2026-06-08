package models

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Schedule represents a scheduled task for a server
type Schedule struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ServerID       uint      `gorm:"not null;index" json:"server_id"`
	Name           string    `gorm:"not null" json:"name"`
	CronMinute     string    `gorm:"not null" json:"cron_minute"`     // 0-59 or *
	CronHour       string    `gorm:"not null" json:"cron_hour"`       // 0-23 or *
	CronDayOfMonth string    `gorm:"not null" json:"cron_day_of_month"` // 1-31 or *
	CronMonth      string    `gorm:"not null" json:"cron_month"`      // 1-12 or *
	CronDayOfWeek  string    `gorm:"not null" json:"cron_day_of_week"`  // 0-6 (0=Sunday) or *
	Enabled        bool      `gorm:"default:true" json:"enabled"`
	Action         string    `gorm:"not null" json:"action"` // send_command, start_server, restart_server, stop_server
	Command        string    `gorm:"default:''" json:"command"` // Only used for send_command action
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// CreateSchedule creates a new schedule
func CreateSchedule(serverID uint, name, cronMinute, cronHour, cronDayOfMonth, cronMonth, cronDayOfWeek string, enabled bool, action, command string) (*Schedule, error) {
	// Validate inputs
	if name == "" {
		return nil, errors.New("schedule name is required")
	}

	if err := ValidateCronField("minute", cronMinute); err != nil {
		return nil, err
	}
	if err := ValidateCronField("hour", cronHour); err != nil {
		return nil, err
	}
	if err := ValidateCronField("day_of_month", cronDayOfMonth); err != nil {
		return nil, err
	}
	if err := ValidateCronField("month", cronMonth); err != nil {
		return nil, err
	}
	if err := ValidateCronField("day_of_week", cronDayOfWeek); err != nil {
		return nil, err
	}

	// Validate action
	validActions := []string{"send_command", "start_server", "restart_server", "stop_server", "backup"}
	isValidAction := false
	for _, validAction := range validActions {
		if action == validAction {
			isValidAction = true
			break
		}
	}
	if !isValidAction {
		return nil, errors.New("invalid action type")
	}

	// If action is send_command, command must not be empty
	if action == "send_command" && command == "" {
		return nil, errors.New("command is required for send_command action")
	}

	schedule := &Schedule{
		ServerID:       serverID,
		Name:           name,
		CronMinute:     cronMinute,
		CronHour:       cronHour,
		CronDayOfMonth: cronDayOfMonth,
		CronMonth:      cronMonth,
		CronDayOfWeek:  cronDayOfWeek,
		Enabled:        enabled,
		Action:         action,
		Command:        command,
	}

	if err := DB.Create(schedule).Error; err != nil {
		return nil, err
	}

	return schedule, nil
}

// GetSchedulesByServerID retrieves all schedules for a specific server
func GetSchedulesByServerID(serverID uint) ([]Schedule, error) {
	var schedules []Schedule
	if err := DB.Where("server_id = ?", serverID).Order("created_at DESC").Find(&schedules).Error; err != nil {
		return nil, err
	}
	return schedules, nil
}

// GetScheduleByID retrieves a schedule by its ID
func GetScheduleByID(id uint) (*Schedule, error) {
	var schedule Schedule
	if err := DB.First(&schedule, id).Error; err != nil {
		return nil, err
	}
	return &schedule, nil
}

// UpdateSchedule updates a schedule
func (s *Schedule) UpdateSchedule(name, cronMinute, cronHour, cronDayOfMonth, cronMonth, cronDayOfWeek string, enabled bool, action, command string) error {
	// Validate inputs
	if name == "" {
		return errors.New("schedule name is required")
	}

	if err := ValidateCronField("minute", cronMinute); err != nil {
		return err
	}
	if err := ValidateCronField("hour", cronHour); err != nil {
		return err
	}
	if err := ValidateCronField("day_of_month", cronDayOfMonth); err != nil {
		return err
	}
	if err := ValidateCronField("month", cronMonth); err != nil {
		return err
	}
	if err := ValidateCronField("day_of_week", cronDayOfWeek); err != nil {
		return err
	}

	// Validate action
	validActions := []string{"send_command", "start_server", "restart_server", "stop_server", "backup"}
	isValidAction := false
	for _, validAction := range validActions {
		if action == validAction {
			isValidAction = true
			break
		}
	}
	if !isValidAction {
		return errors.New("invalid action type")
	}

	// If action is send_command, command must not be empty
	if action == "send_command" && command == "" {
		return errors.New("command is required for send_command action")
	}

	// Update fields
	s.Name = name
	s.CronMinute = cronMinute
	s.CronHour = cronHour
	s.CronDayOfMonth = cronDayOfMonth
	s.CronMonth = cronMonth
	s.CronDayOfWeek = cronDayOfWeek
	s.Enabled = enabled
	s.Action = action
	s.Command = command

	return DB.Save(s).Error
}

// ToggleEnabled toggles the enabled status of a schedule
func (s *Schedule) ToggleEnabled() error {
	s.Enabled = !s.Enabled
	return DB.Save(s).Error
}

// SetEnabled sets the enabled status of a schedule
func (s *Schedule) SetEnabled(enabled bool) error {
	s.Enabled = enabled
	return DB.Save(s).Error
}

// Delete deletes a schedule
func (s *Schedule) Delete() error {
	return DB.Delete(s).Error
}

// GetCronExpression returns the cron expression string
func (s *Schedule) GetCronExpression() string {
	return fmt.Sprintf("%s %s %s %s %s",
		s.CronMinute,
		s.CronHour,
		s.CronDayOfMonth,
		s.CronMonth,
		s.CronDayOfWeek,
	)
}

// ValidateCronField validates a cron field value
func ValidateCronField(fieldName, value string) error {
	if value == "" {
		return fmt.Errorf("%s cannot be empty", fieldName)
	}

	// Allow * (wildcard)
	if value == "*" {
		return nil
	}

	// Allow */n (step values)
	if strings.HasPrefix(value, "*/") {
		stepStr := strings.TrimPrefix(value, "*/")
		step, err := strconv.Atoi(stepStr)
		if err != nil || step < 1 {
			return fmt.Errorf("invalid step value in %s: %s", fieldName, value)
		}
		return nil
	}

	// Allow comma-separated values (e.g., "1,15,30")
	if strings.Contains(value, ",") {
		parts := strings.Split(value, ",")
		for _, part := range parts {
			if err := validateSingleCronValue(fieldName, strings.TrimSpace(part)); err != nil {
				return err
			}
		}
		return nil
	}

	// Allow range values (e.g., "1-5")
	if strings.Contains(value, "-") {
		parts := strings.Split(value, "-")
		if len(parts) != 2 {
			return fmt.Errorf("invalid range in %s: %s", fieldName, value)
		}
		start, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
		end, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
		if err1 != nil || err2 != nil || start >= end {
			return fmt.Errorf("invalid range in %s: %s", fieldName, value)
		}
		return validateCronRange(fieldName, start, end)
	}

	// Single numeric value
	return validateSingleCronValue(fieldName, value)
}

// validateSingleCronValue validates a single numeric cron value
func validateSingleCronValue(fieldName, value string) error {
	num, err := strconv.Atoi(value)
	if err != nil {
		return fmt.Errorf("invalid value in %s: %s", fieldName, value)
	}

	switch fieldName {
	case "minute":
		if num < 0 || num > 59 {
			return fmt.Errorf("minute must be between 0-59, got %d", num)
		}
	case "hour":
		if num < 0 || num > 23 {
			return fmt.Errorf("hour must be between 0-23, got %d", num)
		}
	case "day_of_month":
		if num < 1 || num > 31 {
			return fmt.Errorf("day of month must be between 1-31, got %d", num)
		}
	case "month":
		if num < 1 || num > 12 {
			return fmt.Errorf("month must be between 1-12, got %d", num)
		}
	case "day_of_week":
		if num < 0 || num > 6 {
			return fmt.Errorf("day of week must be between 0-6 (0=Sunday), got %d", num)
		}
	}

	return nil
}

// validateCronRange validates a range of cron values
func validateCronRange(fieldName string, start, end int) error {
	switch fieldName {
	case "minute":
		if start < 0 || end > 59 {
			return fmt.Errorf("minute range must be between 0-59")
		}
	case "hour":
		if start < 0 || end > 23 {
			return fmt.Errorf("hour range must be between 0-23")
		}
	case "day_of_month":
		if start < 1 || end > 31 {
			return fmt.Errorf("day of month range must be between 1-31")
		}
	case "month":
		if start < 1 || end > 12 {
			return fmt.Errorf("month range must be between 1-12")
		}
	case "day_of_week":
		if start < 0 || end > 6 {
			return fmt.Errorf("day of week range must be between 0-6")
		}
	}

	return nil
}

// GetAllEnabledSchedules retrieves all enabled schedules across all servers
func GetAllEnabledSchedules() ([]Schedule, error) {
	var schedules []Schedule
	if err := DB.Where("enabled = ?", true).Find(&schedules).Error; err != nil {
		return nil, err
	}
	return schedules, nil
}