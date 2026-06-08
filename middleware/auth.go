package middleware

import (
	"context"
	"net/http"

	"seiapanel/config"
)

type contextKey string

const UserIDKey contextKey = "userID"

// AuthMiddleware checks if user is authenticated
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get session
		session, err := config.GetSessionStore().Get(r, "auth-session")
		if err != nil {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}

		// Check if user is authenticated
		userID, ok := session.Values["user_id"].(uint)
		if !ok || userID == 0 {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}

		// Add user ID to request context
		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUserID retrieves the user ID from request context
func GetUserID(r *http.Request) uint {
	userID, ok := r.Context().Value(UserIDKey).(uint)
	if !ok {
		return 0
	}
	return userID
}