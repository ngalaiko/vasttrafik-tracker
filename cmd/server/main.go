package main

import (
	"context"
	"flag"
	"log"
	"log/slog"
	"net/http"
	"os"

	"github.com/ngalaiko/kollpaspar/backend/internal/sse"
	"github.com/ngalaiko/kollpaspar/backend/internal/static"
	"github.com/ngalaiko/kollpaspar/backend/internal/tracker"
	"github.com/ngalaiko/kollpaspar/backend/internal/vasttrafik"
	"golang.org/x/sync/errgroup"
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

	wg, ctx := errgroup.WithContext(ctx)
	wg.Go(func() error {
		return w.Watch(ctx, vasttrafik.Trams)
	})

	http.Handle("/", static.Handler())
	http.HandleFunc("/events", stream.Handler())

	wg.Go(func() error {
		slog.InfoContext(ctx, "starting server", "address", *address)
		if err := http.ListenAndServe(":8080", nil); err != http.ErrServerClosed {
			return err
		}
		return nil
	})

	if err := wg.Wait(); err != nil {
		log.Fatal(err)
	}
}
