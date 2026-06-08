package models

import (
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User represents a user account
type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"unique;not null" json:"username"`
	Password  string    `gorm:"not null" json:"-"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateUser creates a new user with hashed password
func CreateUser(username, password string) (*User, error) {
	// Check if username already exists
	var existingUser User
	if err := DB.Where("username = ?", username).First(&existingUser).Error; err == nil {
		return nil, errors.New("username already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user := &User{
		Username: username,
		Password: string(hashedPassword),
	}

	if err := DB.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

// ValidateCredentials checks if username and password are correct
func ValidateCredentials(username, password string) (*User, error) {
	var user User

	// Find user by username
	if err := DB.Where("username = ?", username).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.New("invalid username or password")
		}
		return nil, err
	}

	// Compare password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, errors.New("invalid username or password")
	}

	return &user, nil
}

// GetUserByID retrieves a user by ID
func GetUserByID(id uint) (*User, error) {
	var user User
	if err := DB.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByUsername retrieves a user by username
func GetUserByUsername(username string) (*User, error) {
	var user User
	if err := DB.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdateUsername updates the user's username
func (u *User) UpdateUsername(newUsername string) error {
	// Check if new username already exists
	var existingUser User
	if err := DB.Where("username = ? AND id != ?", newUsername, u.ID).First(&existingUser).Error; err == nil {
		return errors.New("username already exists")
	}

	u.Username = newUsername
	return DB.Save(u).Error
}

// UpdatePassword updates the user's password
func (u *User) UpdatePassword(currentPassword, newPassword string) error {
	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(currentPassword)); err != nil {
		return errors.New("current password is incorrect")
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	u.Password = string(hashedPassword)
	return DB.Save(u).Error
}