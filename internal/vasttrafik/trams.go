package vasttrafik

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

//go:embed trams.json
var data []byte

var Trams = []Line{}

func init() {
	if err := json.Unmarshal(data, &Trams); err != nil {
		panic(fmt.Errorf("failed to unmarshal trams: %w", err))
	}
}

type Line struct {
	Info  LineInfo      `json:"lineInfo"`
	Route []Coordinates `json:"route"`
}
