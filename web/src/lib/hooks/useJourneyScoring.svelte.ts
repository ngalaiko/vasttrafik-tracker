import type {
  Arrival,
  JourneyDetails,
  TripLeg
} from '@vasttrafik-tracker/vasttrafik'
import type { Point } from '$lib/utils'
import type { GpsSample } from '$lib/gpsHistory.svelte'
import {
  closestPointOnPolyline,
  distanceM,
  buildCumulativeDistances,
  distanceAlongPolyline,
  pointAtDistance
} from '$lib/utils'

interface SchedulePoint {
  distance: number
  time: number
}

/**
 * Find the trip leg that contains the arrival's service journey.
 * The old code used `journey.tripLegs.at(-1)` which is wrong for multi-leg journeys.
 */
function findTripLeg(
  journey: JourneyDetails,
  arrival: Arrival
): TripLeg | null {
  for (const leg of journey.tripLegs) {
    for (const sj of leg.serviceJourneys) {
      if (sj.gid === arrival.serviceJourney.gid) {
        return leg
      }
    }
  }
  return null
}

/**
 * Build a schedule mapping: distance along route → time.
 * Uses departure time at each stop (or arrival time for the last stop).
 */
function buildSchedule(
  tripLeg: TripLeg,
  route: Point[],
  cumulativeDistances: number[]
): SchedulePoint[] {
  const schedule: SchedulePoint[] = []

  if (!tripLeg.callsOnTripLeg) return schedule

  for (const call of tripLeg.callsOnTripLeg) {
    const timeStr =
      call.estimatedOtherwisePlannedDepartureTime ??
      call.estimatedOtherwisePlannedArrivalTime
    if (!timeStr) continue

    const projection = closestPointOnPolyline(route, [
      call.stopPoint.latitude,
      call.stopPoint.longitude
    ])
    const distance = distanceAlongPolyline(
      route,
      cumulativeDistances,
      projection
    )

    schedule.push({
      distance,
      time: Date.parse(timeStr)
    })
  }

  return schedule
}

/**
 * Given a schedule (distance/time pairs at each stop) and a timestamp,
 * interpolate to find the expected distance along the route.
 * Assumes constant speed between stops.
 */
function interpolateScheduleDistance(
  schedule: SchedulePoint[],
  timestamp: number
): number | null {
  if (schedule.length < 2) return null

  const first = schedule[0]!
  const last = schedule[schedule.length - 1]!

  // Clamp to schedule range
  if (timestamp <= first.time) return first.distance
  if (timestamp >= last.time) return last.distance

  for (let i = 0; i < schedule.length - 1; i++) {
    const a = schedule[i]!
    const b = schedule[i + 1]!
    if (timestamp >= a.time && timestamp <= b.time) {
      const timeFraction = (timestamp - a.time) / (b.time - a.time)
      return a.distance + timeFraction * (b.distance - a.distance)
    }
  }

  return null
}

/**
 * Score how well a GPS trajectory matches a tram journey.
 *
 * For each GPS sample, we compute where the tram *should* be at that moment
 * (by interpolating its schedule along the route), then measure how far the
 * user is from that expected position.
 *
 * The score is the average distance in meters. A user on the correct tram
 * should score ~10-30m (GPS accuracy). A user standing still, walking, or
 * on a different tram will score hundreds or thousands of meters.
 */
export function scoreJourney(
  journey: JourneyDetails,
  arrival: Arrival,
  gpsSamples: GpsSample[]
): number {
  if (gpsSamples.length === 0) return Infinity

  const tripLeg = findTripLeg(journey, arrival)
  if (!tripLeg?.tripLegCoordinates || tripLeg.tripLegCoordinates.length < 2)
    return Infinity
  if (!tripLeg.callsOnTripLeg || tripLeg.callsOnTripLeg.length < 2)
    return Infinity

  const route = tripLeg.tripLegCoordinates.map(
    (p): Point => [p.latitude, p.longitude]
  )
  const cumulativeDistances = buildCumulativeDistances(route)
  const schedule = buildSchedule(tripLeg, route, cumulativeDistances)

  if (schedule.length < 2) return Infinity

  let totalError = 0
  let validSamples = 0

  for (const sample of gpsSamples) {
    const expectedDistance = interpolateScheduleDistance(
      schedule,
      sample.timestamp
    )
    if (expectedDistance === null) continue

    const expectedPosition = pointAtDistance(
      route,
      cumulativeDistances,
      expectedDistance
    )
    const error = distanceM(sample.position, expectedPosition)
    totalError += error
    validSamples++
  }

  if (validSamples === 0) return Infinity
  return totalError / validSamples
}

export function useJourneyScoring(
  arrivalJourneys: () => Array<{
    arrival: Arrival
    journeyDetails: JourneyDetails
  }>,
  gpsSamples: () => GpsSample[]
) {
  const scored = $derived.by(() => {
    const samples = gpsSamples()
    return arrivalJourneys()
      .map(({ arrival, journeyDetails }) => ({
        ...arrival,
        score: scoreJourney(journeyDetails, arrival, samples)
      }))
      .sort((a, b) => a.score - b.score)
  })

  return {
    get scored() {
      return scored
    }
  }
}
