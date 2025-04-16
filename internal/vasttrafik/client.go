package vasttrafik

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"golang.org/x/oauth2/clientcredentials"
)

const (
	tokenURL = "https://ext-api.vasttrafik.se/token"
)

type Client struct {
	client *http.Client
}

type Config struct {
	ClientID     string
	ClientSecret string
}

func NewClient(ctx context.Context, cfg Config) *Client {
	conf := &clientcredentials.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		TokenURL:     tokenURL,
	}

	return &Client{
		client: conf.Client(ctx),
	}
}

type Coordinates struct {
	Lat  float64
	Long float64
}

type LineInfo struct {
	// Name is the name of the line, e.g. "10" or "11"
	Name string `json:"name"`
	// TransportMode is the transport mode of the line, e.g. "bus" or "tram"
	TransportMode   string `json:"transportMode"`
	BackgoundColor  string `json:"backgroundColor"`
	ForegroundColor string `json:"foregroundColor"`
	BorderColor     string `json:"borderColor"`
}

type Vehicle struct {
	// Name is the name of the vehicle, e.g. "10" or "11"
	Name string `json:"name"`
	// Direction is the direction of the vehicle, e.g. "Frölunda Torg" or "Lindholmen"
	Direction string `json:"direction"`
	// Latitude is the latitude of the vehicle
	Latitude float64 `json:"latitude"`
	// Longitude is the longitude of the vehicle
	Longitude float64 `json:"longitude"`
	// Line is information of the line the vehicle is on
	Line LineInfo `json:"line"`
}

func (c *Client) ListVehicles(ctx context.Context, lowerLeft, upperRight Coordinates) ([]Vehicle, error) {
	params := url.Values{}
	params.Set("lowerLeftLat", fmt.Sprintf("%f", lowerLeft.Lat))
	params.Set("lowerLeftLong", fmt.Sprintf("%f", lowerLeft.Long))
	params.Set("upperRightLat", fmt.Sprintf("%f", upperRight.Lat))
	params.Set("upperRightLong", fmt.Sprintf("%f", upperRight.Long))
	params.Set("limit", "200")

	resp, err := c.client.Get("https://ext-api.vasttrafik.se/pr/v4/positions?" + params.Encode())
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var vehicles []Vehicle
	if err := json.NewDecoder(resp.Body).Decode(&vehicles); err != nil {
		return nil, err
	}

	return vehicles, nil
}
