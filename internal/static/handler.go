package static

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed assets/*
var staticFS embed.FS

func Handler() http.Handler {
	fsys := mustFSSub(staticFS, "assets")
	fileServer := http.FileServer(http.FS(fsys))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fileServer.ServeHTTP(w, r)
	})
}

func mustFSSub(fsys fs.FS, dir string) fs.FS {
	subFS, err := fs.Sub(fsys, dir)
	if err != nil {
		panic(err)
	}
	return subFS
}
