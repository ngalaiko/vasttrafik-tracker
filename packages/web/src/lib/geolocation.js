import { writable } from "svelte/store";

/**
 * @typedef {Object} GeolocationPosition
 * @property {number} latitude - The latitude in decimal degrees
 * @property {number} longitude - The longitude in decimal degrees
 * @property {number} accuracy - The accuracy in meters
 * @property {number} timestamp - The timestamp when the position was acquired
 */

/**
 * @typedef {Object} GeolocationReturn
 * @property {import('svelte/store').Writable<GeolocationPosition|null>} position - Position store
 * @property {import('svelte/store').Writable<GeolocationPositionError|Error|null>} error - Error store
 * @property {import('svelte/store').Writable<boolean>} loading - Loading state store
 * @property {() => void} refresh - Function to refresh the current position
 */

/**
 * Hook for getting current geolocation with reactive stores
 *
 * @returns {GeolocationReturn} Object containing position, error, loading stores and refresh function
 */
export function useGeolocation() {
  const position = writable(/** @type {GeolocationPosition|null} */ (null));
  const error = writable(
    /** @type {GeolocationPositionError|Error|null} */ (null),
  );
  const loading = writable(false);

  /**
   * Gets the current position from the browser's geolocation API
   */
  function getCurrentPosition() {
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
