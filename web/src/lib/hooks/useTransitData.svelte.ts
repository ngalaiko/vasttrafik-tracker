import type {
  StopPoint,
  Arrival,
  JourneyDetails
} from '@vasttrafik-tracker/vasttrafik'
import { transitStore } from '$lib/stores/transitStore.svelte'

export function useTransitData(stops: () => StopPoint[]) {
  // Track active keys so we can release stale instances
  let prevArrivalGids = new Set<string>()
  let prevDetailRefs = new Set<string>()

  const arrivals = $derived.by(() => {
    return stops().map(stopPoint =>
      transitStore.getStopPointArrivals(stopPoint.gid)
    )
  })

  // Release stale stop point arrival instances
  $effect(() => {
    const currentGids = new Set(stops().map(s => s.gid))
    for (const gid of prevArrivalGids) {
      if (!currentGids.has(gid)) {
        transitStore.releaseStopPointArrivals(gid)
      }
    }
    prevArrivalGids = currentGids

    return () => {
      for (const gid of currentGids) {
        transitStore.releaseStopPointArrivals(gid)
      }
    }
  })

  const arrivalValues = $derived.by(() => {
    return arrivals
      .flatMap(a => a.value)
      .filter(arrival => arrival.serviceJourney.line.transportMode === 'tram')
      .filter(
        (arrival, i, all) =>
          all.findIndex(a => a.detailsReference === arrival.detailsReference) ===
          i
      )
  })

  const journeyDetails = $derived.by(() => {
    return arrivalValues.map(arrival =>
      transitStore.getJourneyDetails(arrival.detailsReference)
    )
  })

  // Release stale journey detail instances
  $effect(() => {
    const currentRefs = new Set(arrivalValues.map(a => a.detailsReference))
    for (const ref of prevDetailRefs) {
      if (!currentRefs.has(ref)) {
        transitStore.releaseJourneyDetails(ref)
      }
    }
    prevDetailRefs = currentRefs

    return () => {
      for (const ref of currentRefs) {
        transitStore.releaseJourneyDetails(ref)
      }
    }
  })

  const journeyDetailsValues = $derived.by(() => {
    return journeyDetails
      .flatMap(d => d.value)
      .filter((d): d is JourneyDetails => d !== null)
  })

  const arrivalJourneys = $derived.by(() => {
    return arrivalValues
      .map(arrival => {
        const details = journeyDetailsValues.find(sj =>
          sj.tripLegs.some(leg =>
            leg.serviceJourneys.some(
              sj => sj.gid === arrival.serviceJourney.gid
            )
          )
        )
        return { arrival, journeyDetails: details }
      })
      .filter(
        (
          aj
        ): aj is {
          arrival: Arrival
          journeyDetails: JourneyDetails
        } => aj.journeyDetails !== undefined
      )
  })

  return {
    get arrivalJourneys() {
      return arrivalJourneys
    }
  }
}
