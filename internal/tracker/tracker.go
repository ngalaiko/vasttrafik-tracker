package tracker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/ngalaiko/kollpaspar/backend/internal/sse"
	"github.com/ngalaiko/kollpaspar/backend/internal/vasttrafik"
)

type Tracker struct {
	client *vasttrafik.Client
	stream *sse.Stream
}

func New(client *vasttrafik.Client, stream *sse.Stream) *Tracker {
	return &Tracker{
		client: client,
		stream: stream,
	}
}

func (s *Tracker) Watch(ctx context.Context, routes []string) error {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	vv, err := s.client.ListVehicles(ctx, leftLower, rightUpper, routes)
	if err != nil {
		return fmt.Errorf("failed to list vehicles: %v", err)
	}
	vehicles := make([]ChandeUpdate, len(vv))
	for i, v := range vv {
		vehicles[i] = ChandeUpdate{
			ID:       uuid.New().String(),
			Vehicle:  v,
			LastSeen: time.Now(),
		}
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			vv, err := s.client.ListVehicles(ctx, leftLower, rightUpper, routes)
			if err != nil {
				slog.ErrorContext(ctx, "failed to list vehicles", "error", err)
				continue
			}

			reconciled := reconcile(vehicles, vv)
			events := diff(vehicles, reconciled)

			for _, event := range events {
				jsonBytes, err := json.Marshal(event)
				if err != nil {
					slog.ErrorContext(ctx, "failed to marshal event", "event", event)
				} else {
					s.stream.Broadcast(jsonBytes)
				}
			}

			vehicles = reconciled
		}
	}
}

type ChandeUpdate struct {
	ID       string    `json:"id"`
	LastSeen time.Time `json:"lastSeenAt"`
	vasttrafik.Vehicle
}

type ChangeDelete struct {
	ID string `json:"id"`
}

// Change represents a change in the vehicle list.
type Change struct {
	Update *ChandeUpdate `json:"update,omitempty"`
	Delete *ChangeDelete `json:"delete,omitempty"`
}

// diff compares two slices of vehicles and returns a slice of events representing the changes.
func diff(old, new []ChandeUpdate) []Change {
	oldByIds := make(map[string]ChandeUpdate, len(old))
	for _, v := range old {
		oldByIds[v.ID] = v
	}
	newByIds := make(map[string]ChandeUpdate, len(new))
	for _, v := range new {
		newByIds[v.ID] = v
	}
	var events []Change
	for id, nv := range newByIds {
		if ov, ok := oldByIds[id]; ok {
			if nv != ov {
				events = append(events, Change{Update: &nv})
			}
			delete(oldByIds, id)
		} else {
			events = append(events, Change{Update: &nv})
		}
	}
	for id := range oldByIds {
		events = append(events, Change{Delete: &ChangeDelete{ID: id}})
	}
	return events
}

// reconcile reconciles two slices of vehicles, matching them based on their name and direction.
func reconcile(old []ChandeUpdate, new []vasttrafik.Vehicle) []ChandeUpdate {
	now := time.Now()
	result := make([]ChandeUpdate, 0, len(new))
	used := make(map[string]bool)

	for _, nv := range new {
		var bestMatch *ChandeUpdate
		var bestScore float64

		for i := range old {
			ov := &old[i]
			if used[ov.ID] {
				continue
			}

			s := score(nv, ov.Vehicle)
			if s > bestScore && s >= 2.5 {
				bestScore = s
				bestMatch = ov
			}
		}

		tv := ChandeUpdate{
			Vehicle:  nv,
			LastSeen: now,
		}

		if bestMatch != nil {
			tv.ID = bestMatch.ID
			used[bestMatch.ID] = true
		} else {
			tv.ID = uuid.New().String()
		}

		result = append(result, tv)
	}

	return result
}

func score(a, b vasttrafik.Vehicle) float64 {
	s := 0.0
	if a.Line.Name == b.Line.Name {
		s += 1
	}
	if a.Line.TransportMode == b.Line.TransportMode {
		s += 0.5
	}
	if a.Direction == b.Direction {
		s += 1
	}
	d := haversine(a.Latitude, a.Longitude, b.Latitude, b.Longitude)
	if d < 150 {
		s += 1.5 - (d / 100.0) // max 1.5, fades with distance
	}
	return s
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000.0 // in meters

	rad := func(deg float64) float64 {
		return deg * math.Pi / 180
	}

	lat1Rad := rad(lat1)
	lat2Rad := rad(lat2)
	deltaLat := rad(lat2 - lat1)
	deltaLon := rad(lon2 - lon1)

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(deltaLon/2)*math.Sin(deltaLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}

func boundingBoxAround(lat, lon, radiusKm float64) (vasttrafik.Coordinates, vasttrafik.Coordinates) {
	deltaLat := radiusKm / 111.0
	deltaLon := radiusKm / (111.320 * math.Cos(lat*math.Pi/180.0))

	leftLower := vasttrafik.Coordinates{
		Lat:  lat - deltaLat,
		Long: lon - deltaLon,
	}
	rightUpper := vasttrafik.Coordinates{
		Lat:  lat + deltaLat,
		Long: lon + deltaLon,
	}
	return leftLower, rightUpper
}

var (
	goteborgLat           = 57.706924
	goteborgLong          = 11.966192
	leftLower, rightUpper = boundingBoxAround(goteborgLat, goteborgLong, 30.0)
)
