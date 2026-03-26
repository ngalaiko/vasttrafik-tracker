import { describe, it, expect } from 'vitest'
import { combine, type CombineInput } from './combine'
import type { GpsSample } from '$lib/gpsHistory.svelte'
import type { Point, ScheduleStop, Stop } from '$lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = 1_000_000_000

/** Straight east-west route at lat 57.7, from lon 11.9 to 12.0 */
const route: Point[] = [
  [57.7, 11.9],
  [57.7, 11.925],
  [57.7, 11.95],
  [57.7, 11.975],
  [57.7, 12.0]
]

function makeStop(lon: number): Stop {
  return { gid: `stop-${lon}`, name: `Stop ${lon}`, position: [57.7, lon] }
}

function makeScheduleStop(lon: number, time: number): ScheduleStop {
  return { stop: makeStop(lon), departure: time }
}

/** 5 stops, 3 minutes apart */
const MINUTE = 60_000
const schedule: ScheduleStop[] = [
  makeScheduleStop(11.9, NOW - 3 * MINUTE),
  makeScheduleStop(11.925, NOW),
  makeScheduleStop(11.95, NOW + 3 * MINUTE),
  makeScheduleStop(11.975, NOW + 6 * MINUTE),
  makeScheduleStop(12.0, NOW + 9 * MINUTE)
]

function input(overrides: Partial<CombineInput> = {}): CombineInput {
  return {
    route,
    schedule,
    gpsSamples: [],
    now: NOW,
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('combine', () => {
  describe('diagnostics structure', () => {
    it('returns all diagnostic fields', () => {
      const result = combine(input())
      expect(result).toHaveProperty('motion')
      expect(result).toHaveProperty('projection')
      expect(result).toHaveProperty('bearing')
      expect(result).toHaveProperty('schedule')
      expect(result).toHaveProperty('expectedTramSpeed')
      expect(result).toHaveProperty('userProgressSpeed')
      expect(result).toHaveProperty('avgLateralDistance')
      expect(result).toHaveProperty('lateralStdDev')
      expect(result).toHaveProperty('signals')
      expect(result).toHaveProperty('score')
    })

    it('exposes named signals', () => {
      const samples: GpsSample[] = [
        { position: [57.7, 11.93], timestamp: NOW - 5000 },
        { position: [57.7, 11.94], timestamp: NOW }
      ]
      const result = combine(input({ gpsSamples: samples }))
      const signalNames = result.signals.map(s => s.name)
      expect(signalNames).toContain('bearing')
      expect(signalNames).toContain('speedMatch')
      expect(signalNames).toContain('progressMatch')
      expect(signalNames).toContain('lateral')
      expect(signalNames).toContain('lateralConsistency')
    })

    it('all signal scores are in [0, 1]', () => {
      const samples: GpsSample[] = [
        { position: [57.7, 11.93], timestamp: NOW - 10_000 },
        { position: [57.7, 11.94], timestamp: NOW - 5000 },
        { position: [57.7, 11.95], timestamp: NOW }
      ]
      const result = combine(input({ gpsSamples: samples }))
      for (const s of result.signals) {
        expect(s.score).toBeGreaterThanOrEqual(0)
        expect(s.score).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('scoring', () => {
    it('returns 0 when no GPS samples', () => {
      const result = combine(input())
      expect(result.score).toBe(0)
    })

    it('scores high for user riding the tram', () => {
      const samples: GpsSample[] = [
        { position: [57.7, 11.92], timestamp: NOW - 10_000 },
        { position: [57.7, 11.925], timestamp: NOW - 5000 },
        { position: [57.7, 11.93], timestamp: NOW }
      ]
      const result = combine(input({ gpsSamples: samples }))
      expect(result.score).toBeGreaterThan(0.3)
    })

    it('scores low for stationary user near the line', () => {
      const samples: GpsSample[] = [
        { position: [57.7, 11.93], timestamp: NOW - 10_000 },
        { position: [57.7, 11.93], timestamp: NOW - 5000 },
        { position: [57.7, 11.93], timestamp: NOW }
      ]
      const result = combine(input({ gpsSamples: samples }))
      expect(result.score).toBeLessThan(0.3)
    })

    it('rider scores higher than stationary user', () => {
      const riderSamples: GpsSample[] = [
        { position: [57.7, 11.92], timestamp: NOW - 10_000 },
        { position: [57.7, 11.925], timestamp: NOW - 5000 },
        { position: [57.7, 11.93], timestamp: NOW }
      ]
      const stationarySamples: GpsSample[] = [
        { position: [57.7, 11.93], timestamp: NOW - 10_000 },
        { position: [57.7, 11.93], timestamp: NOW - 5000 },
        { position: [57.7, 11.93], timestamp: NOW }
      ]

      const rider = combine(input({ gpsSamples: riderSamples }))
      const stationary = combine(input({ gpsSamples: stationarySamples }))
      expect(rider.score).toBeGreaterThan(stationary.score)
    })

    it('closer to line scores higher than parallel but offset', () => {
      const onLine: GpsSample[] = [
        { position: [57.7, 11.92], timestamp: NOW - 10_000 },
        { position: [57.7, 11.925], timestamp: NOW - 5000 },
        { position: [57.7, 11.93], timestamp: NOW }
      ]
      const parallel: GpsSample[] = [
        { position: [57.70035, 11.92], timestamp: NOW - 10_000 },
        { position: [57.70035, 11.925], timestamp: NOW - 5000 },
        { position: [57.70035, 11.93], timestamp: NOW }
      ]

      const onLineResult = combine(input({ gpsSamples: onLine }))
      const parallelResult = combine(input({ gpsSamples: parallel }))
      expect(onLineResult.score).toBeGreaterThan(parallelResult.score)
    })

    it('correct direction scores higher than wrong direction', () => {
      const withTram: GpsSample[] = [
        { position: [57.7, 11.92], timestamp: NOW - 10_000 },
        { position: [57.7, 11.925], timestamp: NOW - 5000 },
        { position: [57.7, 11.93], timestamp: NOW }
      ]
      const againstTram: GpsSample[] = [
        { position: [57.7, 11.93], timestamp: NOW - 10_000 },
        { position: [57.7, 11.925], timestamp: NOW - 5000 },
        { position: [57.7, 11.92], timestamp: NOW }
      ]

      const withResult = combine(input({ gpsSamples: withTram }))
      const againstResult = combine(input({ gpsSamples: againstTram }))
      expect(withResult.score).toBeGreaterThan(againstResult.score)
    })

    it('user far from route scores low', () => {
      const samples: GpsSample[] = [
        { position: [57.71, 11.92], timestamp: NOW - 10_000 },
        { position: [57.71, 11.925], timestamp: NOW - 5000 },
        { position: [57.71, 11.93], timestamp: NOW }
      ]
      const result = combine(input({ gpsSamples: samples }))
      expect(result.score).toBeLessThan(0.1)
    })
  })

  describe('edge cases', () => {
    it('handles route with only 2 points', () => {
      const shortRoute: Point[] = [
        [57.7, 11.9],
        [57.7, 12.0]
      ]
      const shortSchedule: ScheduleStop[] = [
        makeScheduleStop(11.9, NOW),
        makeScheduleStop(12.0, NOW + 5 * MINUTE)
      ]
      const samples: GpsSample[] = [
        { position: [57.7, 11.95], timestamp: NOW }
      ]
      const result = combine({
        route: shortRoute,
        schedule: shortSchedule,
        gpsSamples: samples,
        now: NOW
      })
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1)
    })

    it('handles empty schedule', () => {
      const samples: GpsSample[] = [
        { position: [57.7, 11.95], timestamp: NOW }
      ]
      const result = combine({
        route,
        schedule: [],
        gpsSamples: samples,
        now: NOW
      })
      expect(result.schedule).toHaveLength(0)
      expect(result.expectedTramSpeed).toBeNull()
    })

    it('single GPS sample still produces diagnostics', () => {
      const samples: GpsSample[] = [
        { position: [57.7, 11.93], timestamp: NOW }
      ]
      const result = combine(input({ gpsSamples: samples }))
      expect(result.motion.classification).toBe('stationary')
      expect(result.projection).not.toBeNull()
      expect(typeof result.avgLateralDistance).toBe('number')
    })

    it('handles empty route gracefully', () => {
      const samples: GpsSample[] = [
        { position: [57.7, 11.93], timestamp: NOW }
      ]
      const result = combine({
        route: [],
        schedule: [],
        gpsSamples: samples,
        now: NOW
      })
      expect(result.score).toBe(0)
      expect(result.projection).toBeNull()
    })
  })
})
