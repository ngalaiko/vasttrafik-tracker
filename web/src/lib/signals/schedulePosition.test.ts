import { describe, it, expect } from 'vitest'
import {
  buildSchedule,
  interpolateDistance,
  expectedPosition,
  expectedSpeed,
  speedMatch
} from './schedulePosition'
import type { Point, ScheduleStop, Stop } from '$lib/types'
import { buildCumulativeDistances } from '$lib/utils'

const NOW = 1_000_000_000

// Straight east-west route
const route: Point[] = [
  [57.7, 11.9],
  [57.7, 11.95],
  [57.7, 12.0]
]
const cumDist = buildCumulativeDistances(route)

function makeStop(lat: number, lon: number): Stop {
  return { gid: `stop-${lon}`, name: `Stop ${lon}`, position: [lat, lon] }
}

function makeScheduleStop(lat: number, lon: number, time: number): ScheduleStop {
  return { stop: makeStop(lat, lon), departure: time }
}

const stops: ScheduleStop[] = [
  makeScheduleStop(57.7, 11.9, NOW),
  makeScheduleStop(57.7, 11.95, NOW + 60_000),
  makeScheduleStop(57.7, 12.0, NOW + 120_000)
]

const schedule = buildSchedule(stops, route, cumDist)

describe('buildSchedule', () => {
  it('creates schedule points for each stop', () => {
    expect(schedule).toHaveLength(3)
    expect(schedule[0]!.distance).toBeCloseTo(0, 0)
    expect(schedule[0]!.time).toBe(NOW)
  })

  it('has increasing distances', () => {
    expect(schedule[1]!.distance).toBeGreaterThan(schedule[0]!.distance)
    expect(schedule[2]!.distance).toBeGreaterThan(schedule[1]!.distance)
  })

  it('skips stops without time', () => {
    const noTime: ScheduleStop[] = [
      { stop: makeStop(57.7, 11.9) }
    ]
    expect(buildSchedule(noTime, route, cumDist)).toHaveLength(0)
  })
})

describe('interpolateDistance', () => {
  it('returns null for short schedule', () => {
    expect(interpolateDistance([], NOW)).toBeNull()
    expect(interpolateDistance([schedule[0]!], NOW)).toBeNull()
  })

  it('returns first distance before schedule start', () => {
    expect(interpolateDistance(schedule, NOW - 1000)).toBe(schedule[0]!.distance)
  })

  it('returns last distance after schedule end', () => {
    expect(interpolateDistance(schedule, NOW + 200_000)).toBe(
      schedule[2]!.distance
    )
  })

  it('interpolates midpoint correctly', () => {
    const mid = interpolateDistance(schedule, NOW + 30_000)!
    const expected = (schedule[0]!.distance + schedule[1]!.distance) / 2
    expect(mid).toBeCloseTo(expected, 0)
  })
})

describe('expectedPosition', () => {
  it('returns start position at schedule start', () => {
    const pos = expectedPosition(schedule, route, cumDist, NOW)!
    expect(pos[0]).toBeCloseTo(57.7, 3)
    expect(pos[1]).toBeCloseTo(11.9, 2)
  })

  it('returns null for empty schedule', () => {
    expect(expectedPosition([], route, cumDist, NOW)).toBeNull()
  })

  it('returns midpoint position at midpoint time', () => {
    const pos = expectedPosition(schedule, route, cumDist, NOW + 60_000)!
    expect(pos[1]).toBeCloseTo(11.95, 2)
  })
})

describe('expectedSpeed', () => {
  it('returns null for insufficient schedule', () => {
    expect(expectedSpeed([], NOW)).toBeNull()
  })

  it('returns null outside schedule range', () => {
    expect(expectedSpeed(schedule, NOW - 1000)).toBeNull()
    expect(expectedSpeed(schedule, NOW + 200_000)).toBeNull()
  })

  it('returns consistent speed for evenly spaced stops', () => {
    const s1 = expectedSpeed(schedule, NOW + 10_000)!
    const s2 = expectedSpeed(schedule, NOW + 70_000)!
    expect(s1).toBeCloseTo(s2, 0)
    expect(s1).toBeGreaterThan(0)
  })
})

describe('speedMatch', () => {
  it('returns 1 for identical speeds', () => {
    expect(speedMatch(10, 10)).toBeCloseTo(1)
  })

  it('returns 1 when both stationary', () => {
    expect(speedMatch(0, 0)).toBe(1)
  })

  it('returns 0 when one is stationary', () => {
    expect(speedMatch(0, 10)).toBe(0)
    expect(speedMatch(10, 0)).toBe(0)
  })

  it('returns 0.5 when one is double the other', () => {
    expect(speedMatch(5, 10)).toBeCloseTo(0.5)
  })

  it('is symmetric', () => {
    expect(speedMatch(3, 10)).toBeCloseTo(speedMatch(10, 3))
  })
})
