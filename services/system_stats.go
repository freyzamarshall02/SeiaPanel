package services

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// SystemInfo holds system information
type SystemInfo struct {
	CPUModel string
	CPUCores int
	CPUSpeed string
}

// MemoryStats holds memory statistics
type MemoryStats struct {
	Total       uint64  // bytes
	Used        uint64  // bytes
	Free        uint64  // bytes
	UsedPercent float64 // percentage
}

// DiskStats holds disk statistics
type DiskStats struct {
	Total       uint64  // bytes
	Used        uint64  // bytes
	Free        uint64  // bytes
	UsedPercent float64 // percentage
}

// CPUStats holds CPU timing statistics
type cpuStats struct {
	user    uint64
	nice    uint64
	system  uint64
	idle    uint64
	iowait  uint64
	irq     uint64
	softirq uint64
	steal   uint64
}

// GetSystemInfo returns system information (CPU model, cores, speed)
func GetSystemInfo() (*SystemInfo, error) {
	info := &SystemInfo{
		CPUModel: "Unknown",
		CPUCores: 0,
		CPUSpeed: "Unknown",
	}

	// Read /proc/cpuinfo
	file, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return info, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	coreCount := 0
	modelFound := false
	speedFound := false

	for scanner.Scan() {
		line := scanner.Text()

		// Get CPU model name
		if !modelFound && strings.HasPrefix(line, "model name") {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				info.CPUModel = strings.TrimSpace(parts[1])
				modelFound = true
			}
		}

		// Get CPU speed
		if !speedFound && strings.HasPrefix(line, "cpu MHz") {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				mhz := strings.TrimSpace(parts[1])
				if mhzFloat, err := strconv.ParseFloat(mhz, 64); err == nil {
					ghz := mhzFloat / 1000.0
					info.CPUSpeed = fmt.Sprintf("%.3f GHz", ghz)
					speedFound = true
				}
			}
		}

		// Count processors
		if strings.HasPrefix(line, "processor") {
			coreCount++
		}
	}

	info.CPUCores = coreCount

	return info, nil
}

// GetMemoryStats returns current memory statistics
func GetMemoryStats() (*MemoryStats, error) {
	stats := &MemoryStats{}

	// Read /proc/meminfo
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	memInfo := make(map[string]uint64)
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)

		if len(fields) >= 2 {
			key := strings.TrimSuffix(fields[0], ":")
			value, err := strconv.ParseUint(fields[1], 10, 64)
			if err == nil {
				// Convert from KB to bytes
				memInfo[key] = value * 1024
			}
		}
	}

	// Calculate memory statistics
	stats.Total = memInfo["MemTotal"]
	available := memInfo["MemAvailable"]
	stats.Free = available
	stats.Used = stats.Total - available

	if stats.Total > 0 {
		stats.UsedPercent = (float64(stats.Used) / float64(stats.Total)) * 100
	}

	return stats, nil
}

// GetDiskStats returns disk usage statistics for root partition
func GetDiskStats() (*DiskStats, error) {
	return getDiskStatsActual("/")
}

// getDiskStatsActual uses syscall.Statfs for accurate disk statistics
func getDiskStatsActual(path string) (*DiskStats, error) {
	var stat syscall.Statfs_t
	err := syscall.Statfs(path, &stat)
	if err != nil {
		return nil, err
	}

	stats := &DiskStats{
		Total: stat.Blocks * uint64(stat.Bsize),
		Free:  stat.Bfree * uint64(stat.Bsize),
	}
	
	stats.Used = stats.Total - stats.Free
	
	if stats.Total > 0 {
		stats.UsedPercent = (float64(stats.Used) / float64(stats.Total)) * 100
	}

	return stats, nil
}

// GetCPUUsage returns current CPU usage percentage
func GetCPUUsage() (float64, error) {
	// Read CPU stats twice with a small interval
	stats1, err := readCPUStats()
	if err != nil {
		return 0, err
	}

	// Wait 100ms
	time.Sleep(100 * time.Millisecond)

	stats2, err := readCPUStats()
	if err != nil {
		return 0, err
	}

	// Calculate CPU usage
	return calculateCPUUsage(stats1, stats2), nil
}

// readCPUStats reads CPU statistics from /proc/stat
func readCPUStats() (*cpuStats, error) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return nil, fmt.Errorf("failed to read /proc/stat")
	}

	line := scanner.Text()
	fields := strings.Fields(line)

	if len(fields) < 8 || fields[0] != "cpu" {
		return nil, fmt.Errorf("invalid /proc/stat format")
	}

	stats := &cpuStats{}
	stats.user, _ = strconv.ParseUint(fields[1], 10, 64)
	stats.nice, _ = strconv.ParseUint(fields[2], 10, 64)
	stats.system, _ = strconv.ParseUint(fields[3], 10, 64)
	stats.idle, _ = strconv.ParseUint(fields[4], 10, 64)
	stats.iowait, _ = strconv.ParseUint(fields[5], 10, 64)
	stats.irq, _ = strconv.ParseUint(fields[6], 10, 64)
	stats.softirq, _ = strconv.ParseUint(fields[7], 10, 64)

	if len(fields) >= 9 {
		stats.steal, _ = strconv.ParseUint(fields[8], 10, 64)
	}

	return stats, nil
}

// calculateCPUUsage calculates CPU usage percentage from two stat readings
func calculateCPUUsage(prev, curr *cpuStats) float64 {
	prevIdle := prev.idle + prev.iowait
	currIdle := curr.idle + curr.iowait

	prevNonIdle := prev.user + prev.nice + prev.system + prev.irq + prev.softirq + prev.steal
	currNonIdle := curr.user + curr.nice + curr.system + curr.irq + curr.softirq + curr.steal

	prevTotal := prevIdle + prevNonIdle
	currTotal := currIdle + currNonIdle

	totald := currTotal - prevTotal
	idled := currIdle - prevIdle

	if totald == 0 {
		return 0
	}

	cpuUsage := (float64(totald) - float64(idled)) / float64(totald) * 100.0

	return cpuUsage
}