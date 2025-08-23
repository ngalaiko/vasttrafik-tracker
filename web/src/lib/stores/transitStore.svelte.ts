import { StopPointArrivals } from '$lib/stopPointArrivals.svelte'
import { JourneyDetails } from '$lib/journeyDetails.svelte'

class TransitStore {
  getStopPointArrivals(stopGid: string): StopPointArrivals {
    return new StopPointArrivals(stopGid, { refreshInterval: 3000 }) // 3 seconds for real-time
  }

  getJourneyDetails(detailsReference: string): JourneyDetails {
    return new JourneyDetails(detailsReference, {
      refreshInterval: 3000
    }) // 3 seconds for real-time
  }
}

// Export singleton instance
export const transitStore = new TransitStore()
