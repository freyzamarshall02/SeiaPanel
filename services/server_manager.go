package services

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"seiapanel/models"

	"github.com/gorilla/websocket"
)

// ServerProcess holds the running server process information
type ServerProcess struct {
	Server  *models.Server
	Cmd     *exec.Cmd
	Stdin   io.WriteCloser
	Stdout  io.ReadCloser
	Stderr  io.ReadCloser
	Logs    []string
	LogMux  sync.Mutex
	Clients []*websocket.Conn
	ClientMux sync.Mutex
}

// ServerStats holds server statistics
type ServerStats struct {
	MemoryMB float64 `json:"memory_mb"`
	MemoryGB float64 `json:"memory_gb"`
	PID      int     `json:"pid"`
	IsRunning bool   `json:"is_running"`
}

var (
	runningServers = make(map[uint]*ServerProcess)
	serverMux      sync.Mutex
)

// StartServer starts a Minecraft server
func StartServer(server *models.Server) error {
	serverMux.Lock()
	defer serverMux.Unlock()

	// Check if server is already running
	if _, exists := runningServers[server.ID]; exists {
		return errors.New("server is already running")
	}

	// Parse startup command
	parts := strings.Fields(server.StartupCommand)
	if len(parts) == 0 {
		return errors.New("invalid startup command")
	}

	// Create command
	cmd := exec.Command(parts[0], parts[1:]...)
	cmd.Dir = server.FolderPath

	// Get stdin, stdout, stderr pipes
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	// Start the process
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start server: %w", err)
	}

	// Create server process
	sp := &ServerProcess{
		Server:  server,
		Cmd:     cmd,
		Stdin:   stdin,
		Stdout:  stdout,
		Stderr:  stderr,
		Logs:    make([]string, 0),
		Clients: make([]*websocket.Conn, 0),
	}

	runningServers[server.ID] = sp

	// Update server status
	server.SetStatus("online")

	// Start reading output
	go sp.readOutput(stdout, false)
	go sp.readOutput(stderr, true)

	// Monitor process
	go sp.monitorProcess()

	log.Printf("✅ Server '%s' started successfully (PID: %d)", server.Name, cmd.Process.Pid)
	return nil
}

// StopServer stops a running Minecraft server
func StopServer(server *models.Server) error {
	serverMux.Lock()
	defer serverMux.Unlock()

	sp, exists := runningServers[server.ID]
	if !exists {
		return errors.New("server is not running")
	}

	log.Printf("⏹️  Stopping server '%s'...", server.Name)

	// Send stop command to server
	if sp.Stdin != nil {
		sp.Stdin.Write([]byte("stop\n"))
		sp.Stdin.Write([]byte("end\n")) // Some servers use "end"
	}

	// Wait for graceful shutdown (with timeout)
	done := make(chan error, 1)
	go func() {
		done <- sp.Cmd.Wait()
	}()

	select {
	case <-done:
		// Process stopped gracefully
		log.Printf("✅ Server '%s' stopped gracefully", server.Name)
	case <-time.After(30 * time.Second):
		// Force kill if not stopped after 30 seconds
		log.Printf("⚠️  Server '%s' did not stop gracefully, forcing kill", server.Name)
		if sp.Cmd.Process != nil {
			sp.Cmd.Process.Kill()
		}
	}

	// Clean up
	delete(runningServers, server.ID)
	server.SetStatus("offline")

	// Close all WebSocket connections
	sp.ClientMux.Lock()
	for _, client := range sp.Clients {
		client.WriteMessage(websocket.TextMessage, []byte("\n=== Server stopped ===\n"))
		client.Close()
	}
	sp.Clients = []*websocket.Conn{}
	sp.ClientMux.Unlock()

	return nil
}

// RestartServer restarts a Minecraft server
func RestartServer(server *models.Server) error {
	// Stop the server
	if err := StopServer(server); err != nil {
		// If server is not running, just start it
		if err.Error() == "server is not running" {
			return StartServer(server)
		}
		return err
	}

	// Wait a moment before restarting
	time.Sleep(2 * time.Second)

	// Start the server
	return StartServer(server)
}

// SendCommand sends a command to the server console
func SendCommand(server *models.Server, command string) error {
	serverMux.Lock()
	sp, exists := runningServers[server.ID]
	serverMux.Unlock()

	if !exists {
		return errors.New("server is not running")
	}

	if sp.Stdin == nil {
		return errors.New("server stdin is not available")
	}

	// Write command to stdin
	_, err := sp.Stdin.Write([]byte(command + "\n"))
	if err != nil {
		return fmt.Errorf("failed to send command: %w", err)
	}

	return nil
}

// GetLogs returns the server logs
func GetLogs(server *models.Server) []string {
	serverMux.Lock()
	sp, exists := runningServers[server.ID]
	serverMux.Unlock()

	if !exists {
		return []string{}
	}

	sp.LogMux.Lock()
	defer sp.LogMux.Unlock()

	// Return copy of logs
	logs := make([]string, len(sp.Logs))
	copy(logs, sp.Logs)
	return logs
}

// GetServerStats returns server statistics (memory usage, etc.)
func GetServerStats(server *models.Server) (*ServerStats, error) {
	serverMux.Lock()
	sp, exists := runningServers[server.ID]
	serverMux.Unlock()

	if !exists {
		return &ServerStats{
			MemoryMB:  0,
			MemoryGB:  0,
			PID:       0,
			IsRunning: false,
		}, nil
	}

	pid := sp.Cmd.Process.Pid
	memoryKB, err := getProcessMemory(pid)
	if err != nil {
		log.Printf("⚠️  Failed to get memory for PID %d: %v", pid, err)
		return &ServerStats{
			MemoryMB:  0,
			MemoryGB:  0,
			PID:       pid,
			IsRunning: true,
		}, nil
	}

	memoryMB := float64(memoryKB) / 1024.0
	memoryGB := memoryMB / 1024.0

	return &ServerStats{
		MemoryMB:  memoryMB,
		MemoryGB:  memoryGB,
		PID:       pid,
		IsRunning: true,
	}, nil
}

// getProcessMemory reads memory usage from /proc/[pid]/status
func getProcessMemory(pid int) (int64, error) {
	// Read /proc/[pid]/status
	statusFile := fmt.Sprintf("/proc/%d/status", pid)
	file, err := os.Open(statusFile)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		// Look for VmRSS (Resident Set Size - actual RAM usage)
		if strings.HasPrefix(line, "VmRSS:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				memKB, err := strconv.ParseInt(fields[1], 10, 64)
				if err != nil {
					return 0, err
				}
				return memKB, nil
			}
		}
	}

	return 0, fmt.Errorf("VmRSS not found in /proc/%d/status", pid)
}

// AddConsoleListener adds a WebSocket client to receive console updates
func AddConsoleListener(server *models.Server, conn *websocket.Conn) {
	serverMux.Lock()
	sp, exists := runningServers[server.ID]
	serverMux.Unlock()

	if !exists {
		log.Printf("⚠️  Cannot add console listener: server %s is not running", server.Name)
		conn.WriteMessage(websocket.TextMessage, []byte("Error: Server is not running\n"))
		conn.Close()
		return
	}

	sp.ClientMux.Lock()
	sp.Clients = append(sp.Clients, conn)
	clientCount := len(sp.Clients)
	sp.ClientMux.Unlock()

	log.Printf("✅ WebSocket client connected to server '%s' (total clients: %d)", server.Name, clientCount)

	// Send existing logs to new client
	sp.LogMux.Lock()
	for _, logLine := range sp.Logs {
		conn.WriteMessage(websocket.TextMessage, []byte(logLine))
	}
	sp.LogMux.Unlock()

	// Set up ping/pong handlers for keepalive
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Start ping ticker
	ticker := time.NewTicker(30 * time.Second)
	go func() {
		defer ticker.Stop()
		for range ticker.C {
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}()
}

// RemoveConsoleListener removes a WebSocket client
func RemoveConsoleListener(server *models.Server, conn *websocket.Conn) {
	serverMux.Lock()
	sp, exists := runningServers[server.ID]
	serverMux.Unlock()

	if !exists {
		return
	}

	sp.ClientMux.Lock()
	defer sp.ClientMux.Unlock()

	for i, client := range sp.Clients {
		if client == conn {
			sp.Clients = append(sp.Clients[:i], sp.Clients[i+1:]...)
			log.Printf("🔌 WebSocket client disconnected from server '%s' (remaining: %d)", server.Name, len(sp.Clients))
			break
		}
	}
}

// readOutput reads from stdout/stderr and broadcasts to clients
func (sp *ServerProcess) readOutput(reader io.ReadCloser, isError bool) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		
		// Strip ANSI color codes
		line = stripAnsiCodes(line)

		// Add to logs
		sp.LogMux.Lock()
		sp.Logs = append(sp.Logs, line)
		// Keep only last 1000 lines
		if len(sp.Logs) > 1000 {
			sp.Logs = sp.Logs[len(sp.Logs)-1000:]
		}
		sp.LogMux.Unlock()

		// Broadcast to WebSocket clients
		sp.ClientMux.Lock()
		disconnectedClients := []int{}
		for i, client := range sp.Clients {
			err := client.WriteMessage(websocket.TextMessage, []byte(line))
			if err != nil {
				// Mark client for removal
				disconnectedClients = append(disconnectedClients, i)
			}
		}
		
		// Remove disconnected clients
		for i := len(disconnectedClients) - 1; i >= 0; i-- {
			idx := disconnectedClients[i]
			sp.Clients = append(sp.Clients[:idx], sp.Clients[idx+1:]...)
		}
		sp.ClientMux.Unlock()
	}
	
	if err := scanner.Err(); err != nil {
		log.Printf("⚠️  Error reading output from server '%s': %v", sp.Server.Name, err)
	}
}

// stripAnsiCodes removes ANSI escape sequences from text
func stripAnsiCodes(text string) string {
	// Remove ANSI color codes like [38;2;255;170;0m and [0m
	result := ""
	inEscape := false
	
	for i := 0; i < len(text); i++ {
		if text[i] == 0x1B && i+1 < len(text) && text[i+1] == '[' {
			// Start of ANSI sequence
			inEscape = true
			i++ // Skip the '['
			continue
		}
		
		if inEscape {
			// Skip until we find 'm' (end of color code)
			if text[i] == 'm' {
				inEscape = false
			}
			continue
		}
		
		result += string(text[i])
	}
	
	return result
}

// monitorProcess monitors the server process and updates status
func (sp *ServerProcess) monitorProcess() {
	// Wait for process to end
	err := sp.Cmd.Wait()
	
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
	}

	log.Printf("⚠️  Server '%s' process ended (exit code: %d)", sp.Server.Name, exitCode)

	// Process has stopped - clean up
	serverMux.Lock()
	delete(runningServers, sp.Server.ID)
	serverMux.Unlock()

	sp.Server.SetStatus("offline")

	// Notify all WebSocket clients that server is offline
	sp.ClientMux.Lock()
	for _, client := range sp.Clients {
		client.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\n=== Server stopped (exit code: %d) ===\n", exitCode)))
		client.Close()
	}
	sp.Clients = []*websocket.Conn{}
	sp.ClientMux.Unlock()
}

// IsServerRunning checks if a server is currently running
func IsServerRunning(server *models.Server) bool {
	serverMux.Lock()
	defer serverMux.Unlock()

	_, exists := runningServers[server.ID]
	return exists
}
