package sse

import (
	"fmt"
	"net/http"
	"sync"
)

type Stream struct {
	mu      sync.RWMutex
	clients map[chan []byte]struct{}
}

func NewStream() *Stream {
	return &Stream{
		clients: map[chan []byte]struct{}{},
	}
}

func (s *Stream) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)

		ch := make(chan []byte)

		s.mu.Lock()
		s.clients[ch] = struct{}{}
		s.mu.Unlock()

		for {
			select {
			case msg := <-ch:
				_, _ = fmt.Fprintf(w, "data: %s\n\n", msg)
				flusher.Flush()
			case <-r.Context().Done():
				s.mu.Lock()
				delete(s.clients, ch)
				close(ch)
				s.mu.Unlock()
				return
			}
		}
	}
}

func (s *Stream) Broadcast(data []byte) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for ch := range s.clients {
		ch <- data
	}
}
