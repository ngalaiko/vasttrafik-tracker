import { writable, type Writable } from 'svelte/store'
import type { Point } from './utils'

export interface GeolocationReturn {
  position: Writable<Point | null>
  error: Writable<GeolocationPositionError | Error | null>
  loading: Writable<boolean>
  refresh: () => void
  stop: () => void
}

export function useGeolocation(): GeolocationReturn {
  const position = writable<Point | null>(null)
  const error = writable<GeolocationPositionError | Error | null>(null)
  const loading = writable(false)

  let intervalId: number | null = null

  function getCurrentPosition(): void {
    if (!navigator.geolocation) {
      error.set(new Error('Geolocation is not supported'))
      return
    }

    loading.set(true)
    error.set(null)

    navigator.geolocation.getCurrentPosition(
      pos => {
        position.set([pos.coords.latitude, pos.coords.longitude])
        loading.set(false)
      },
      err => {
        error.set(err)
        loading.set(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Always get fresh position
      }
    )
  }

  function startTracking(): void {
    if (typeof window === 'undefined') return

    // Get initial position
    getCurrentPosition()

    // Set up interval for updates every 10 seconds
    intervalId = window.setInterval(() => {
      getCurrentPosition()
    }, 10000)
  }

  function stopTracking(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // Start tracking on initialization
  startTracking()

  return {
    position,
    error,
    loading,
    refresh: getCurrentPosition,
    stop: stopTracking
  }
}
