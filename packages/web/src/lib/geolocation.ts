import { writable, type Writable } from 'svelte/store';
import type { Point } from './utils';

export interface GeolocationReturn {
  position: Writable<Point | null>;
  error: Writable<GeolocationPositionError | Error | null>;
  loading: Writable<boolean>;
  refresh: () => void;
}

export function useGeolocation(): GeolocationReturn {
  const position = writable<Point | null>(null);
  const error = writable<GeolocationPositionError | Error | null>(null);
  const loading = writable(false);

  function getCurrentPosition(): void {
    if (!navigator.geolocation) {
      error.set(new Error('Geolocation is not supported'));
      return;
    }

    loading.set(true);
    error.set(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        position.set([pos.coords.latitude, pos.coords.longitude]);
        loading.set(false);
      },
      (err) => {
        error.set(err);
        loading.set(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000, // 10 seconds
      }
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
