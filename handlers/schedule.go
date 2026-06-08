package handlers

import (
	"encoding/json"
	"html/template"
	"net/http"
	"strconv"

	"seiapanel/middleware"
	"seiapanel/models"
	"seiapanel/services"

	"github.com/gorilla/mux"
)

// SchedulePage renders the schedule page
func SchedulePage(w http.ResponseWriter, r *http.Request) {
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

	tmpl, err := template.ParseFiles("templates/schedule.html")
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

// ListSchedules returns all schedules for a server as JSON
func ListSchedules(w http.ResponseWriter, r *http.Request) {
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

	// Get schedules
	schedules, err := models.GetSchedulesByServerID(server.ID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to retrieve schedules",
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"schedules": schedules,
	})
}

// GetSchedule returns a single schedule by ID as JSON
func GetSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	scheduleIDStr := vars["id"]
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

	// Parse schedule ID
	scheduleID, err := strconv.ParseUint(scheduleIDStr, 10, 32)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid schedule ID",
		})
		return
	}

	// Get schedule
	schedule, err := models.GetScheduleByID(uint(scheduleID))
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Schedule not found",
		})
		return
	}

	// Verify schedule belongs to this server
	if schedule.ServerID != server.ID {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"schedule": schedule,
	})
}

// CreateSchedule creates a new schedule
func CreateSchedule(w http.ResponseWriter, r *http.Request) {
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

	// Get form values
	name := r.FormValue("name")
	cronMinute := r.FormValue("cron_minute")
	cronHour := r.FormValue("cron_hour")
	cronDayOfMonth := r.FormValue("cron_day_of_month")
	cronMonth := r.FormValue("cron_month")
	cronDayOfWeek := r.FormValue("cron_day_of_week")
	enabledStr := r.FormValue("enabled")
	action := r.FormValue("action")
	command := r.FormValue("command")

	// Parse enabled flag
	enabled := enabledStr == "true" || enabledStr == "1"

	// Create schedule
	schedule, err := models.CreateSchedule(
		server.ID,
		name,
		cronMinute,
		cronHour,
		cronDayOfMonth,
		cronMonth,
		cronDayOfWeek,
		enabled,
		action,
		command,
	)

	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Add to cron scheduler if enabled
	if enabled {
		scheduleService := services.GetScheduleService()
		if scheduleService != nil {
			if err := scheduleService.AddSchedule(*schedule); err != nil {
				// Log error but don't fail the request
				// The schedule is still created in the database
				w.WriteHeader(http.StatusCreated)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"success":  true,
					"message":  "Schedule created but failed to add to scheduler",
					"schedule": schedule,
				})
				return
			}
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Schedule created successfully",
		"schedule": schedule,
	})
}

// UpdateSchedule updates an existing schedule
func UpdateSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	scheduleIDStr := vars["id"]
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

	// Parse schedule ID
	scheduleID, err := strconv.ParseUint(scheduleIDStr, 10, 32)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid schedule ID",
		})
		return
	}

	// Get schedule
	schedule, err := models.GetScheduleByID(uint(scheduleID))
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Schedule not found",
		})
		return
	}

	// Verify schedule belongs to this server
	if schedule.ServerID != server.ID {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied",
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

	// Get form values
	name := r.FormValue("name")
	cronMinute := r.FormValue("cron_minute")
	cronHour := r.FormValue("cron_hour")
	cronDayOfMonth := r.FormValue("cron_day_of_month")
	cronMonth := r.FormValue("cron_month")
	cronDayOfWeek := r.FormValue("cron_day_of_week")
	enabledStr := r.FormValue("enabled")
	action := r.FormValue("action")
	command := r.FormValue("command")

	// Parse enabled flag
	enabled := enabledStr == "true" || enabledStr == "1"

	// Update schedule
	err = schedule.UpdateSchedule(
		name,
		cronMinute,
		cronHour,
		cronDayOfMonth,
		cronMonth,
		cronDayOfWeek,
		enabled,
		action,
		command,
	)

	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Update in cron scheduler
	scheduleService := services.GetScheduleService()
	if scheduleService != nil {
		if err := scheduleService.UpdateSchedule(*schedule); err != nil {
			// Log error but don't fail the request
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":  true,
				"message":  "Schedule updated but failed to update scheduler",
				"schedule": schedule,
			})
			return
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Schedule updated successfully",
		"schedule": schedule,
	})
}

// DeleteSchedule deletes a schedule
func DeleteSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	scheduleIDStr := vars["id"]
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

	// Parse schedule ID
	scheduleID, err := strconv.ParseUint(scheduleIDStr, 10, 32)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid schedule ID",
		})
		return
	}

	// Get schedule
	schedule, err := models.GetScheduleByID(uint(scheduleID))
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Schedule not found",
		})
		return
	}

	// Verify schedule belongs to this server
	if schedule.ServerID != server.ID {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	// Remove from cron scheduler
	scheduleService := services.GetScheduleService()
	if scheduleService != nil {
		scheduleService.RemoveSchedule(schedule.ID)
	}

	// Delete from database
	if err := schedule.Delete(); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to delete schedule",
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Schedule deleted successfully",
	})
}

// ToggleSchedule toggles the enabled status of a schedule
func ToggleSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	scheduleIDStr := vars["id"]
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

	// Parse schedule ID
	scheduleID, err := strconv.ParseUint(scheduleIDStr, 10, 32)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid schedule ID",
		})
		return
	}

	// Get schedule
	schedule, err := models.GetScheduleByID(uint(scheduleID))
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Schedule not found",
		})
		return
	}

	// Verify schedule belongs to this server
	if schedule.ServerID != server.ID {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	// Toggle enabled status
	if err := schedule.ToggleEnabled(); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to toggle schedule",
		})
		return
	}

	// Update in cron scheduler
	scheduleService := services.GetScheduleService()
	if scheduleService != nil {
		scheduleService.UpdateSchedule(*schedule)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Schedule toggled successfully",
		"enabled":  schedule.Enabled,
		"schedule": schedule,
	})
}

// ExecuteSchedule executes a schedule manually
func ExecuteSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	serverName := vars["name"]
	scheduleIDStr := vars["id"]
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

	// Parse schedule ID
	scheduleID, err := strconv.ParseUint(scheduleIDStr, 10, 32)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid schedule ID",
		})
		return
	}

	// Get schedule
	schedule, err := models.GetScheduleByID(uint(scheduleID))
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Schedule not found",
		})
		return
	}

	// Verify schedule belongs to this server
	if schedule.ServerID != server.ID {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	// Execute schedule manually
	scheduleService := services.GetScheduleService()
	if scheduleService != nil {
		scheduleService.ExecuteScheduleManually(*schedule)
	} else {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Schedule service not available",
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Schedule executed successfully",
	})
}