import type { JourneyDetailsApiModel } from '@vasttrafik-tracker/vasttrafik'
import { journeyDetails } from './api'

const DEFAULT_REFRESH_INTERVAL = 10000 // 10 seconds

export class JourneyDetails {
  value = $state<JourneyDetailsApiModel | null>(null)
  error = $state<Error | null>(null)
  loading = $state(false)

  #interval: number | null = null

  #fetchJourneyDetails(detailsReference: string) {
    this.loading = true
    journeyDetails(detailsReference, {
      includes: ['triplegcoordinates']
    })
      .then(response => {
        this.value = response
        this.error = null
      })
      .catch(err => {
        this.error = err
        this.value = null
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
    this.#fetchJourneyDetails(gid)

    $effect(() => {
      if (this.#interval !== null) {
        clearInterval(this.#interval)
      }
      this.#interval = window.setInterval(() => {
        this.#fetchJourneyDetails(gid)
      }, opts.refreshInterval)
    })
  }
}
