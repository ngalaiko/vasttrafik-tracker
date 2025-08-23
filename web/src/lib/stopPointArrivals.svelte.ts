import type { ArrivalApiModel } from '@vasttrafik-tracker/vasttrafik'
import { stopPointArrivals } from './api'

const DEFAULT_REFRESH_INTERVAL = 5000 // 5 seconds for real-time updates

export class StopPointArrivals {
  value = $state<ArrivalApiModel[]>([])
  error = $state<Error | null>(null)
  loading = $state(false)

  #interval: number | null = null

  #fetchArrivals(gid: string) {
    this.loading = true
    stopPointArrivals(gid, {
      maxArrivalsPerLineAndDirection: 1
    })
      .then(response => {
        this.value = response.results ?? []
        this.error = null
      })
      .catch(err => {
        this.error = err
        this.value = []
      })
      .finally(() => {
        this.loading = false
      })
  }

  constructor(
    gid: string,
    opts: { refreshInterval: number } = {
      refreshInterval: DEFAULT_REFRESH_INTERVAL
    }
  ) {
    this.#fetchArrivals(gid)

    $effect(() => {
      if (this.#interval !== null) {
        clearInterval(this.#interval)
      }
      if (typeof window !== 'undefined') {
        this.#interval = window.setInterval(() => {
          this.#fetchArrivals(gid)
        }, opts.refreshInterval)
      }

      return () => {
        if (this.#interval !== null) {
          clearInterval(this.#interval)
          this.#interval = null
        }
      }
    })
  }
}
