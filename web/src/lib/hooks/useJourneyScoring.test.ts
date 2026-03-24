import { describe, it, expect } from 'vitest'
import { scoreJourney } from './useJourneyScoring.svelte'
import type {
  Arrival,
  JourneyDetails
} from '@vasttrafik-tracker/vasttrafik'
import type { GpsSample } from '$lib/gpsHistory.svelte'
import type { Point } from '$lib/utils'

// --- helpers to build minimal test data ---

function makeStopPoint(gid: string, lat: number, lon: number) {
  return {
    gid,
    name: gid,
    platform: '',
    latitude: lat,
    longitude: lon,
    stopArea: { gid, name: gid, latitude: lat, longitude: lon }
  }
}

/**
 * Build a straight east–west tram route with N stops evenly spaced.
 * Returns journey details, an arrival referencing the second stop,
 * and the route coordinates as Points for convenience.
 */
function buildStraightRoute(opts: {
  startLat: number
  startLon: number
  endLon: number
  numStops: number
  departureTime: number // epoch ms at first stop
  arrivalTime: number // epoch ms at last stop
}) {
  const { startLat, startLon, endLon, numStops, departureTime, arrivalTime } =
    opts
  const lonStep = (endLon - startLon) / (numStops - 1)
  const timeStep = (arrivalTime - departureTime) / (numStops - 1)

  // Build coordinates – one point per stop is enough for a straight line
  const coords = Array.from({ length: numStops }, (_, i) => ({
    latitude: startLat,
    longitude: startLon + i * lonStep
  }))

  const calls = Array.from({ length: numStops }, (_, i) => {
    const time = new Date(departureTime + i * timeStep).toISOString()
    return {
      stopPoint: makeStopPoint(
        `stop-${i}`,
        startLat,
        startLon + i * lonStep
      ),
      estimatedOtherwisePlannedDepartureTime: time,
      estimatedOtherwisePlannedArrivalTime: time
    }
  })

  const serviceJourneyGid = 'sj-1'

  const journey: JourneyDetails = {
    tripLegs: [
      {
        callsOnTripLeg: calls,
        tripLegCoordinates: coords,
        serviceJourneys: [
          {
            gid: serviceJourneyGid
          }
        ]
      }
    ]
  }

  // Arrival at the second stop (index 1)
  const arrival: Arrival = {
    detailsReference: 'ref-1',
    serviceJourney: {
      gid: serviceJourneyGid,
      line: {
        name: '1',
        backgroundColor: '#000',
        foregroundColor: '#fff',
        borderColor: '#000',
        transportMode: 'tram'
      }
    },
    stopPoint: calls[1]!.stopPoint
  }

  return {
    journey,
    arrival,
    coords: coords.map((c): Point => [c.latitude, c.longitude])
  }
}

// --- tests ---

describe('scoreJourney', () => {
  const NOW = Date.now()
  const MINUTE = 60_000

  // A straight east–west route: 5 stops, 10 minutes total
  const route = buildStraightRoute({
    startLat: 57.7,
    startLon: 11.9,
    endLon: 11.95,
    numStops: 5,
    departureTime: NOW - 5 * MINUTE,
    arrivalTime: NOW + 5 * MINUTE
  })

  it('returns Infinity for empty samples', () => {
    expect(scoreJourney(route.journey, route.arrival, [])).toBe(Infinity)
  })

  it('scores low when user follows the tram exactly', () => {
    // Generate samples that follow the tram's expected position
    const samples: GpsSample[] = []
    for (let i = -3; i <= 3; i++) {
      const t = NOW + i * MINUTE
      // At time t, the tram should be at a specific longitude
      // Route goes from 11.9 to 11.95 over 10 minutes centred on NOW
      const progress = (t - (NOW - 5 * MINUTE)) / (10 * MINUTE)
      const lon = 11.9 + progress * 0.05
      samples.push({ position: [57.7, lon], timestamp: t })
    }

    const score = scoreJourney(route.journey, route.arrival, samples)
    // Should be very close to 0 (within GPS-like accuracy)
    expect(score).toBeLessThan(50) // less than 50 meters
  })

  it('scores high when user is stationary at a fixed point', () => {
    // User standing still at the midpoint of the route
    const samples: GpsSample[] = []
    for (let i = -3; i <= 3; i++) {
      samples.push({
        position: [57.7, 11.925], // midpoint
        timestamp: NOW + i * MINUTE
      })
    }

    const score = scoreJourney(route.journey, route.arrival, samples)
    // Tram is moving; user is not. Old samples will be far from expected position.
    expect(score).toBeGreaterThan(200)
  })

  it('scores high when user is far from the route', () => {
    // User 1km north of the route, "moving" in sync schedule-wise
    const samples: GpsSample[] = []
    for (let i = -3; i <= 3; i++) {
      const t = NOW + i * MINUTE
      const progress = (t - (NOW - 5 * MINUTE)) / (10 * MINUTE)
      const lon = 11.9 + progress * 0.05
      samples.push({ position: [57.71, lon], timestamp: t }) // ~1km north
    }

    const score = scoreJourney(route.journey, route.arrival, samples)
    // ~1000m away from the route at every point
    expect(score).toBeGreaterThan(800)
  })

  it('scores lower for the correct tram than for a stationary user', () => {
    const onTramSamples: GpsSample[] = []
    const stationarySamples: GpsSample[] = []

    for (let i = -3; i <= 3; i++) {
      const t = NOW + i * MINUTE
      const progress = (t - (NOW - 5 * MINUTE)) / (10 * MINUTE)
      const lon = 11.9 + progress * 0.05

      onTramSamples.push({ position: [57.7, lon], timestamp: t })
      stationarySamples.push({ position: [57.7, 11.925], timestamp: t })
    }

    const onTramScore = scoreJourney(
      route.journey,
      route.arrival,
      onTramSamples
    )
    const stationaryScore = scoreJourney(
      route.journey,
      route.arrival,
      stationarySamples
    )

    expect(onTramScore).toBeLessThan(stationaryScore)
  })

  it('handles a single GPS sample gracefully', () => {
    // With one sample, falls back to single-point scoring
    const samples: GpsSample[] = [
      { position: [57.7, 11.925], timestamp: NOW }
    ]

    const score = scoreJourney(route.journey, route.arrival, samples)
    expect(Number.isFinite(score)).toBe(true)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('returns Infinity when trip leg has no coordinates', () => {
    const noCoords: JourneyDetails = {
      tripLegs: [
        {
          callsOnTripLeg: route.journey.tripLegs[0]!.callsOnTripLeg!,
          serviceJourneys: route.journey.tripLegs[0]!.serviceJourneys
        }
      ]
    }

    const samples: GpsSample[] = [
      { position: [57.7, 11.925], timestamp: NOW }
    ]
    expect(scoreJourney(noCoords, route.arrival, samples)).toBe(Infinity)
  })
})
