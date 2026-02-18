package handlers

import (
	"encoding/json"
	"html/template"
	"net/http"

	"seiapanel/config"
	"seiapanel/middleware"
	"seiapanel/models"
)

// AccountPage renders the account management page
func AccountPage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	user, err := models.GetUserByID(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	session, _ := config.GetSessionStore().Get(r, "auth-session")

	tmpl, err := template.ParseFiles("templates/account.html")
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

// UpdateUsername handles username update - AJAX JSON response
func UpdateUsername(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID := middleware.GetUserID(r)
	user, err := models.GetUserByID(userID)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "User not found",
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

	newUsername := r.FormValue("username")

	// Validate input
	if newUsername == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Username cannot be empty",
		})
		return
	}

	if newUsername == user.Username {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "New username is the same as current username",
		})
		return
	}

	// Update username
	if err := user.UpdateUsername(newUsername); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Update session with new username
	session, _ := config.GetSessionStore().Get(r, "auth-session")
	session.Values["username"] = newUsername
	session.Save(r, w)

	// Return success response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Username updated successfully",
		"username": newUsername,
	})
}

// UpdatePassword handles password update - AJAX JSON response
func UpdatePassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID := middleware.GetUserID(r)
	user, err := models.GetUserByID(userID)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "User not found",
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

	currentPassword := r.FormValue("current_password")
	newPassword := r.FormValue("new_password")
	confirmPassword := r.FormValue("confirm_password")

	// Validate inputs
	if currentPassword == "" || newPassword == "" || confirmPassword == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "All password fields are required",
		})
		return
	}

	if len(newPassword) < 8 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "New password must be at least 8 characters",
		})
		return
	}

	if newPassword != confirmPassword {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "New passwords do not match",
		})
		return
	}

	if currentPassword == newPassword {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "New password must be different from current password",
		})
		return
	}

	// Update password
	if err := user.UpdatePassword(currentPassword, newPassword); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Return success response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Password updated successfully",
	})
}