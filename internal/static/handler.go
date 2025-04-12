package static

import (
	"embed"
	"net/http"
)

//go:embed assets/*
var staticFS embed.FS

func Handler() http.Handler {
	return http.FileServer(http.FS(staticFS))
}
