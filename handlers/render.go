package handlers

import (
	"html/template"
	"log"
	"net/http"
	"path/filepath"
)

var partials = []string{
	"templates/partials/head.html",
	"templates/partials/sidebar_main.html",
	"templates/partials/sidebar_server.html",
	"templates/partials/sidebar_user.html",
	"templates/partials/alerts.html",
	"templates/partials/scripts.html",
}

// RenderPage parses the layout + page + all partials and executes the layout.
// layout: "base" or "auth"
// page: "dashboard", "console", "login", etc.
func RenderPage(w http.ResponseWriter, layout string, page string, data map[string]interface{}) {
	files := []string{
		filepath.Join("templates/layouts", layout+".html"),
		filepath.Join("templates/pages", page+".html"),
	}
	files = append(files, partials...)

	tmpl, err := template.ParseFiles(files...)
	if err != nil {
		log.Printf("Template parse error: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	err = tmpl.ExecuteTemplate(w, layout, data)
	if err != nil {
		log.Printf("Template execute error: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}
