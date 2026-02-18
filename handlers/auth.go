package handlers

import (
	"encoding/json"
	"html/template"
	"net/http"

	"seiapanel/config"
	"seiapanel/models"
)

// LoginPage renders the login page
func LoginPage(w http.ResponseWriter, r *http.Request) {
	// Check if user is already logged in
	session, _ := config.GetSessionStore().Get(r, "auth-session")
	if userID, ok := session.Values["user_id"].(uint); ok && userID != 0 {
		http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
		return
	}

	// Check if any user exists in the database
	var count int64
	models.DB.Model(&models.User{}).Count(&count)
	
	// If no users exist, redirect to register page
	if count == 0 {
		http.Redirect(w, r, "/register", http.StatusSeeOther)
		return
	}

	tmpl, err := template.ParseFiles("templates/login.html")
	if err != nil {
		http.Error(w, "Error loading template", http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"Error":   session.Flashes("error"),
		"Success": session.Flashes("success"),
	}
	session.Save(r, w)

	tmpl.Execute(w, data)
}

// Login handles user login - AJAX JSON response
func Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Parse form data
	if err := r.ParseForm(); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Error parsing form",
		})
		return
	}

	username := r.FormValue("username")
	password := r.FormValue("password")

	// Validate credentials
	user, err := models.ValidateCredentials(username, password)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid username or password",
		})
		return
	}

	// Create session
	session, _ := config.GetSessionStore().Get(r, "auth-session")
	session.Values["user_id"] = user.ID
	session.Values["username"] = user.Username
	session.Save(r, w)

	// Return success response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Login successful",
		"redirect": "/dashboard",
	})
}

// RegisterPage renders the register page
func RegisterPage(w http.ResponseWriter, r *http.Request) {
	// Check if user is already logged in
	session, _ := config.GetSessionStore().Get(r, "auth-session")
	if userID, ok := session.Values["user_id"].(uint); ok && userID != 0 {
		http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
		return
	}

	// Check if any user already exists
	var count int64
	models.DB.Model(&models.User{}).Count(&count)
	
	// If user already exists, redirect to login (single user system)
	if count > 0 {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}

	tmpl, err := template.ParseFiles("templates/register.html")
	if err != nil {
		http.Error(w, "Error loading template", http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"Error": session.Flashes("error"),
	}
	session.Save(r, w)

	tmpl.Execute(w, data)
}

// Register handles user registration - AJAX JSON response
func Register(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Check if any user already exists (single user system)
	var count int64
	models.DB.Model(&models.User{}).Count(&count)
	
	if count > 0 {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Registration is disabled. An account already exists.",
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

	username := r.FormValue("username")
	password := r.FormValue("password")
	confirmPassword := r.FormValue("confirm_password")

	// Validate inputs
	if username == "" || password == "" || confirmPassword == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "All fields are required",
		})
		return
	}

	if len(password) < 8 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Password must be at least 8 characters",
		})
		return
	}

	if password != confirmPassword {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Passwords do not match",
		})
		return
	}

	// Create user
	_, err := models.CreateUser(username, password)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Return success response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Account created successfully! Please login.",
		"redirect": "/",
	})
}

// Logout handles user logout
func Logout(w http.ResponseWriter, r *http.Request) {
	// Clear session
	session, _ := config.GetSessionStore().Get(r, "auth-session")
	session.Values["user_id"] = uint(0)
	session.Values["username"] = ""
	session.Options.MaxAge = -1
	session.Save(r, w)

	// Redirect to login
	http.Redirect(w, r, "/", http.StatusSeeOther)
}