import type { Trip, ScoredTrip } from '$lib/types'
import type { GpsSample } from '$lib/gpsHistory.svelte'
import { combine, type ScoringDiagnostics } from '$lib/signals'

export function scoreTrip(
  trip: Trip,
  gpsSamples: GpsSample[],
  now?: number
): ScoringDiagnostics {
  return combine({
    route: trip.coordinates,
    schedule: trip.schedule,
    gpsSamples,
    now
  })
}

export function useJourneyScoring(
  trips: () => Trip[],
  gpsSamples: () => GpsSample[]
) {
  const scored = $derived.by(() => {
    const samples = gpsSamples()
    const now = Date.now()
    return trips()
      .map((trip): ScoredTrip => {
        const diagnostics = scoreTrip(trip, samples, now)
        return { trip, score: diagnostics.score, diagnostics }
      })
      .sort((a, b) => b.score - a.score)
  })

  return {
    get scored() {
      return scored
    }
  }
}
