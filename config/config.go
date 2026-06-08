package config

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/sessions"
)

// Config holds application configuration
type Config struct {
	ServerFolderPath string `json:"server_folder_path"`
	Port             string `json:"port"`
	SessionSecret    string `json:"session_secret"`
}

var (
	AppConfig    *Config
	SessionStore *sessions.CookieStore
)

// Init initializes the configuration
func Init() {
	// Load or create config
	AppConfig = loadConfig()

	// Initialize session store
	SessionStore = sessions.NewCookieStore([]byte(AppConfig.SessionSecret))
	SessionStore.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 7, // 7 days
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}

	log.Println("✅ Configuration loaded successfully")
}

// loadConfig loads configuration from file or creates default
func loadConfig() *Config {
	configFile := "./config.json"

	// Check if config file exists
	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		// Create default config
		config := &Config{
			ServerFolderPath: "",
			Port:             "6767",
			SessionSecret:    generateRandomSecret(),
		}

		// Save default config
		saveConfig(config)
		log.Println("⚙️  Created default configuration file")
		return config
	}

	// Read existing config
	data, err := os.ReadFile(configFile)
	if err != nil {
		log.Fatal("Failed to read config file:", err)
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		log.Fatal("Failed to parse config file:", err)
	}

	return &config
}

// saveConfig saves configuration to file
func saveConfig(config *Config) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile("./config.json", data, 0644)
}

// UpdateServerPath updates the server folder path
func UpdateServerPath(path string) error {
	AppConfig.ServerFolderPath = path
	return saveConfig(AppConfig)
}

// GetServerPath returns the configured server folder path
func GetServerPath() string {
	return AppConfig.ServerFolderPath
}

// generateRandomSecret generates a random session secret
func generateRandomSecret() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		log.Fatal("Failed to generate session secret:", err)
	}
	return base64.StdEncoding.EncodeToString(b)
}

// GetSessionStore returns the session store
func GetSessionStore() *sessions.CookieStore {
	return SessionStore
}