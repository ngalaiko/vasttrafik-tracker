import { describe, it, expect } from 'vitest'
import { scoreTrip } from './useJourneyScoring.svelte'
import type { Trip, Route, Stop, Point } from '$lib/types'
import type { GpsSample } from '$lib/gpsHistory.svelte'

// --- helpers ---

function makeStop(gid: string, lat: number, lon: number): Stop {
  return { gid, name: gid, position: [lat, lon] }
}

function buildStraightTrip(opts: {
  startLat: number
  startLon: number
  endLon: number
  numStops: number
  departureTime: number
  arrivalTime: number
}): Trip {
  const { startLat, startLon, endLon, numStops, departureTime, arrivalTime } = opts
  const lonStep = (endLon - startLon) / (numStops - 1)
  const timeStep = (arrivalTime - departureTime) / (numStops - 1)

  const stops = Array.from({ length: numStops }, (_, i) =>
    makeStop(`stop-${i}`, startLat, startLon + i * lonStep)
  )

  const coordinates: Point[] = stops.map(s => s.position)

  const schedule = stops.map((stop, i) => {
    const time = departureTime + i * timeStep
    return { stop, departure: time, arrival: time }
  })

  const route: Route = {
    name: '1',
    direction: stops[stops.length - 1]!.name,
    colors: { background: '#000', foreground: '#fff', border: '#000' },
    stops,
    coordinates
  }

  return {
    serviceJourneyGid: 'sj-1',
    route,
    coordinates,
    schedule,
    nextStop: stops[1]!
  }
}

// --- tests ---

describe('scoreTrip', () => {
  const NOW = Date.now()
  const MINUTE = 60_000

  const trip = buildStraightTrip({
    startLat: 57.7,
    startLon: 11.9,
    endLon: 11.95,
    numStops: 5,
    departureTime: NOW - 5 * MINUTE,
    arrivalTime: NOW + 5 * MINUTE
  })

  it('returns diagnostics with all fields', () => {
    const samples: GpsSample[] = [
      { position: [57.7, 11.925], timestamp: NOW }
    ]
    const result = scoreTrip(trip, samples, NOW)
    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('signals')
    expect(result).toHaveProperty('motion')
  })

  it('scores > 0 when user follows the tram exactly', () => {
    const samples: GpsSample[] = []
    for (let i = -3; i <= 3; i++) {
      const t = NOW + i * MINUTE
      const progress = (t - (NOW - 5 * MINUTE)) / (10 * MINUTE)
      const lon = 11.9 + progress * 0.05
      samples.push({ position: [57.7, lon], timestamp: t })
    }
    const result = scoreTrip(trip, samples, NOW)
    expect(result.score).toBeGreaterThan(0)
  })

  it('stationary user scores lower than riding user', () => {
    const onTramSamples: GpsSample[] = []
    const stationarySamples: GpsSample[] = []

    for (let i = -3; i <= 3; i++) {
      const t = NOW + i * MINUTE
      const progress = (t - (NOW - 5 * MINUTE)) / (10 * MINUTE)
      const lon = 11.9 + progress * 0.05

      onTramSamples.push({ position: [57.7, lon], timestamp: t })
      stationarySamples.push({ position: [57.7, 11.925], timestamp: t })
    }

    const onTram = scoreTrip(trip, onTramSamples, NOW)
    const stationary = scoreTrip(trip, stationarySamples, NOW)
    expect(onTram.score).toBeGreaterThan(stationary.score)
  })

  it('user far from route scores low', () => {
    const samples: GpsSample[] = []
    for (let i = -3; i <= 3; i++) {
      const t = NOW + i * MINUTE
      const progress = (t - (NOW - 5 * MINUTE)) / (10 * MINUTE)
      const lon = 11.9 + progress * 0.05
      samples.push({ position: [57.71, lon], timestamp: t })
    }
    const result = scoreTrip(trip, samples, NOW)
    expect(result.score).toBeLessThan(0.1)
  })

  it('returns score 0 for empty samples', () => {
    const result = scoreTrip(trip, [], NOW)
    expect(result.score).toBe(0)
  })

  it('handles a single GPS sample gracefully', () => {
    const samples: GpsSample[] = [
      { position: [57.7, 11.925], timestamp: NOW }
    ]
    const result = scoreTrip(trip, samples, NOW)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1)
  })
})
