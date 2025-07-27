import type { Point } from './utils'

export function useGeolocation() {
  let coordinates = $state<Point | null>(null)
  let error = $state<GeolocationPositionError | Error | null>(null)
  let loading = $state(false)

  let subscribe: number | null = null

  $effect(() => {
    if (typeof window === 'undefined') {
      error = new Error('Geolocation is not supported in this environment')
      return
    }
    if (!navigator.geolocation) {
      error = new Error('Geolocation is not supported')
      return
    }

    loading = true
    subscribe = navigator.geolocation.watchPosition(
      position => {
        coordinates = [position.coords.latitude, position.coords.longitude]
        loading = false
      },
      err => {
        error = err
        loading = false
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0 // Always get fresh position
      }
    )
    return () => {
      if (subscribe !== null) {
        navigator.geolocation.clearWatch(subscribe)
      }
    }
  })

  return {
    get coordinates() {
      return coordinates
    },
    get error() {
      return error
    },
    get loading() {
      return loading
    }
  }
}
