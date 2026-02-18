package models

import (
	"log"
	"os"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDatabase initializes the SQLite database connection
func InitDatabase() {
	var err error

	// Create database directory if it doesn't exist
	if err := os.MkdirAll("./database", os.ModePerm); err != nil {
		log.Fatal("Failed to create database directory:", err)
	}

	// Open SQLite database
	DB, err = gorm.Open(sqlite.Open("./database/app.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})

	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	log.Println("✅ Database connected successfully")

	// Auto migrate models
	err = DB.AutoMigrate(&User{}, &Server{}, &Backup{}, &Schedule{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	log.Println("✅ Database tables migrated successfully")
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return DB
}