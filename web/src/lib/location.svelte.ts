import type { Point } from './utils'

export class Location {
  coordinates = $state<Point | null>(null)
  error = $state<GeolocationPositionError | Error | null>(null)
  loading = $state(false)

  #watchId: number | null = null

  constructor() {
    if (typeof window === 'undefined') {
      this.error = new Error(
        'Geolocation is not supported in this environment'
      )
      return
    }
    if (!navigator.geolocation) {
      this.error = new Error('Geolocation is not supported')
      return
    }

    this.loading = true
    this.#watchId = navigator.geolocation.watchPosition(
      position => {
        this.coordinates = [
          position.coords.latitude,
          position.coords.longitude
        ]
        this.loading = false
      },
      err => {
        this.error = err
        this.loading = false
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0 // Always get fresh position
      }
    )
  }

  destroy() {
    if (this.#watchId !== null) {
      navigator.geolocation.clearWatch(this.#watchId)
      this.#watchId = null
    }
  }
}
