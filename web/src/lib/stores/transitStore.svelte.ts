import { PollingResource } from '$lib/pollingResource.svelte'
import { stopPointArrivals, journeyDetails } from '$lib/api'
import type { Arrival, JourneyDetails } from '@vasttrafik-tracker/vasttrafik'

class TransitStore {
  #arrivals = new Map<string, PollingResource<Arrival[]>>()
  #journeyDetails = new Map<string, PollingResource<JourneyDetails | null>>()

  getStopPointArrivals(stopGid: string): PollingResource<Arrival[]> {
    let instance = this.#arrivals.get(stopGid)
    if (!instance) {
      instance = new PollingResource(
        () =>
          stopPointArrivals(stopGid, {
            maxArrivalsPerLineAndDirection: 1
          }).then(r => r.results ?? []),
        [],
        { refreshInterval: 3000 }
      )
      this.#arrivals.set(stopGid, instance)
    }
    return instance
  }

  releaseStopPointArrivals(stopGid: string) {
    const instance = this.#arrivals.get(stopGid)
    if (instance) {
      instance.destroy()
      this.#arrivals.delete(stopGid)
    }
  }

  getJourneyDetails(
    detailsReference: string
  ): PollingResource<JourneyDetails | null> {
    let instance = this.#journeyDetails.get(detailsReference)
    if (!instance) {
      instance = new PollingResource(
        () =>
          journeyDetails(detailsReference, {
            includes: ['triplegcoordinates']
          }),
        null,
        { refreshInterval: 3000 }
      )
      this.#journeyDetails.set(detailsReference, instance)
    }
    return instance
  }

  releaseJourneyDetails(detailsReference: string) {
    const instance = this.#journeyDetails.get(detailsReference)
    if (instance) {
      instance.destroy()
      this.#journeyDetails.delete(detailsReference)
    }
  }
}

// Export singleton instance
export const transitStore = new TransitStore()
