import type { Route, Trip, Stop, ScheduleStop } from '$lib/types'
import type {
  Arrival,
  JourneyDetails,
  TripLeg
} from '@vasttrafik-tracker/vasttrafik'
import { transitStore } from '$lib/stores/transitStore.svelte'

/** Find the trip leg that matches a service journey GID. */
function findTripLeg(
  journey: JourneyDetails,
  serviceJourneyGid: string
): TripLeg | null {
  for (const leg of journey.tripLegs) {
    for (const sj of leg.serviceJourneys) {
      if (sj.gid === serviceJourneyGid) return leg
    }
  }
  return null
}

/** Convert an API arrival's stop point to our Stop type. */
function toStop(sp: { gid: string; name: string; latitude: number; longitude: number }): Stop {
  return { gid: sp.gid, name: sp.name, position: [sp.latitude, sp.longitude] }
}

/** Build a Trip from API data + static route. */
function buildTrip(
  arrival: Arrival,
  journey: JourneyDetails,
  route: Route
): Trip | null {
  const tripLeg = findTripLeg(journey, arrival.serviceJourney.gid)
  if (!tripLeg?.tripLegCoordinates || tripLeg.tripLegCoordinates.length < 2) return null
  if (!tripLeg.callsOnTripLeg || tripLeg.callsOnTripLeg.length < 2) return null

  const coordinates = tripLeg.tripLegCoordinates.map(
    (c): [number, number] => [c.latitude, c.longitude]
  )

  const schedule: ScheduleStop[] = tripLeg.callsOnTripLeg.map(call => ({
    stop: toStop(call.stopPoint),
    departure: call.estimatedOtherwisePlannedDepartureTime
      ? Date.parse(call.estimatedOtherwisePlannedDepartureTime)
      : undefined,
    arrival: call.estimatedOtherwisePlannedArrivalTime
      ? Date.parse(call.estimatedOtherwisePlannedArrivalTime)
      : undefined
  }))

  return {
    serviceJourneyGid: arrival.serviceJourney.gid,
    route,
    coordinates,
    schedule,
    nextStop: toStop(arrival.stopPoint)
  }
}

export function useTransitData(routes: () => Route[]) {
  // Track active keys so we can release stale instances
  let prevArrivalGids = new Set<string>()
  let prevDetailRefs = new Set<string>()

  // Collect unique stop GIDs across all nearby routes
  const stopGids = $derived.by(() => {
    const gids = new Set<string>()
    for (const route of routes()) {
      for (const stop of route.stops) {
        gids.add(stop.gid)
      }
    }
    return [...gids]
  })

  const arrivals = $derived.by(() => {
    return stopGids.map(gid => transitStore.getStopPointArrivals(gid))
  })

  // Release stale stop point arrival instances
  $effect(() => {
    const currentGids = new Set(stopGids)
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
          all.findIndex(a => a.detailsReference === arrival.detailsReference) === i
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

  /** Build Trip objects by matching arrivals → journey details → static routes. */
  const trips = $derived.by(() => {
    const currentRoutes = routes()
    const result: Trip[] = []

    for (const arrival of arrivalValues) {
      // Find the matching journey details
      const journey = journeyDetailsValues.find(j =>
        j.tripLegs.some(leg =>
          leg.serviceJourneys.some(sj => sj.gid === arrival.serviceJourney.gid)
        )
      )
      if (!journey) continue

      // Match to a static route by line name + checking if the arrival's stop is on the route.
      // API line.name may be "Spårvagn 7" while route.name is "7", so check both
      // exact match and whether the API name ends with the route name.
      const lineName = arrival.serviceJourney.line.name
      const matchedRoute = currentRoutes.find(
        r =>
          (r.name === lineName || lineName.endsWith(r.name)) &&
          r.stops.some(s => s.gid === arrival.stopPoint.gid)
      )
      if (!matchedRoute) continue

      const trip = buildTrip(arrival, journey, matchedRoute)
      if (trip) result.push(trip)
    }

    // Deduplicate by serviceJourneyGid
    const seen = new Set<string>()
    return result.filter(t => {
      if (seen.has(t.serviceJourneyGid)) return false
      seen.add(t.serviceJourneyGid)
      return true
    })
  })

  return {
    get trips() {
      return trips
    }
  }
}
