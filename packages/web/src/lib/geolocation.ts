import { writable, type Writable } from "svelte/store";

export interface CustomGeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationReturn {
  position: Writable<CustomGeolocationPosition | null>;
  error: Writable<GeolocationPositionError | Error | null>;
  loading: Writable<boolean>;
  refresh: () => void;
}

export function useGeolocation(): GeolocationReturn {
  const position = writable<CustomGeolocationPosition | null>(null);
  const error = writable<GeolocationPositionError | Error | null>(null);
  const loading = writable(false);

  function getCurrentPosition(): void {
    if (!navigator.geolocation) {
      error.set(new Error("Geolocation is not supported"));
      return;
    }

    loading.set(true);
    error.set(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        position.set({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        loading.set(false);
      },
      (err) => {
        error.set(err);
        loading.set(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      },
    );
  }

  // Auto-fetch on component mount
  getCurrentPosition();

  return {
    position,
    error,
    loading,
    refresh: getCurrentPosition,
  };
}
