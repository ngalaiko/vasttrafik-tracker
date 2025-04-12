package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"

	"github.com/ngalaiko/kollpaspar/backend/internal/sse"
	"github.com/ngalaiko/kollpaspar/backend/internal/static"
	"github.com/ngalaiko/kollpaspar/backend/internal/tracker"
	"github.com/ngalaiko/kollpaspar/backend/internal/vasttrafik"
)

var address = flag.String("address", ":8080", "address to listen on")

func main() {
	flag.Parse()

	clientID := os.Getenv("VASTTRAFIK_CLIENT_ID")
	if clientID == "" {
		log.Fatal("VASTTRAFIK_CLIENT_ID is not set")
	}
	clientSecret := os.Getenv("VASTTRAFIK_CLIENT_SECRET")
	if clientSecret == "" {
		log.Fatal("VASTTRAFIK_CLIENT_SECRET is not set")
	}

	ctx := context.Background()
	client := vasttrafik.NewClient(ctx, vasttrafik.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
	})

	stream := sse.NewStream()

	w := tracker.New(client, stream)
	go func() {
		if err := w.Watch(ctx); err != nil {
			log.Printf("watch: %v", err)
		}
	}()

	http.Handle("/", static.Handler())
	http.HandleFunc("/events", stream.Handler())

	log.Println("🚀 Serving on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
