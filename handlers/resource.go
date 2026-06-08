package handlers

import (
	"encoding/json"
	"html/template"
	"net/http"

	"seiapanel/config"
	"seiapanel/middleware"
	"seiapanel/models"
	"seiapanel/services"
)

// ResourcePage renders the resource monitoring page
func ResourcePage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	user, err := models.GetUserByID(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	session, _ := config.GetSessionStore().Get(r, "auth-session")

	tmpl, err := template.ParseFiles("templates/resource.html")
	if err != nil {
		http.Error(w, "Error loading template", http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"User":    user,
		"Success": session.Flashes("success"),
		"Error":   session.Flashes("error"),
	}
	session.Save(r, w)

	tmpl.Execute(w, data)
}

// GetSystemStats returns current system statistics as JSON
func GetSystemStats(w http.ResponseWriter, r *http.Request) {
	// Get CPU stats
	cpuUsage, err := services.GetCPUUsage()
	if err != nil {
		cpuUsage = 0
	}

	// Get memory stats
	memStats, err := services.GetMemoryStats()
	if err != nil {
		memStats = &services.MemoryStats{
			Total:       0,
			Used:        0,
			Free:        0,
			UsedPercent: 0,
		}
	}

	// Get disk stats
	diskStats, err := services.GetDiskStats()
	if err != nil {
		diskStats = &services.DiskStats{
			Total:       0,
			Used:        0,
			Free:        0,
			UsedPercent: 0,
		}
	}

	// Get system info
	sysInfo, err := services.GetSystemInfo()
	if err != nil {
		sysInfo = &services.SystemInfo{
			CPUModel: "Unknown",
			CPUCores: 0,
			CPUSpeed: "Unknown",
		}
	}

	// Count active servers
	userID := middleware.GetUserID(r)
	servers, _ := models.GetServersByUserID(userID)
	activeServers := 0
	for _, server := range servers {
		if server.Status == "online" {
			activeServers++
		}
	}

	// Prepare response
	response := map[string]interface{}{
		"cpu": map[string]interface{}{
			"usage":   cpuUsage,
			"model":   sysInfo.CPUModel,
			"cores":   sysInfo.CPUCores,
			"speed":   sysInfo.CPUSpeed,
			"percent": cpuUsage,
		},
		"memory": map[string]interface{}{
			"total":         memStats.Total,
			"used":          memStats.Used,
			"free":          memStats.Free,
			"used_percent":  memStats.UsedPercent,
			"total_gb":      float64(memStats.Total) / (1024 * 1024 * 1024),
			"used_gb":       float64(memStats.Used) / (1024 * 1024 * 1024),
		},
		"disk": map[string]interface{}{
			"total":        diskStats.Total,
			"used":         diskStats.Used,
			"free":         diskStats.Free,
			"used_percent": diskStats.UsedPercent,
			"total_gb":     float64(diskStats.Total) / (1024 * 1024 * 1024),
			"used_gb":      float64(diskStats.Used) / (1024 * 1024 * 1024),
		},
		"servers": map[string]interface{}{
			"total":  len(servers),
			"active": activeServers,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}