/**
 * Derived signals from schedule data:
 * expected tram position at a given time, expected tram speed, speed match.
 */
import type { Point, ScheduleStop } from '$lib/types'
import {
  closestPointOnPolyline,
  distanceAlongPolyline,
  buildCumulativeDistances,
  pointAtDistance
} from '$lib/utils'

export interface SchedulePoint {
  /** Distance along route in meters. */
  distance: number
  /** Timestamp (epoch ms). */
  time: number
}

/**
 * Build a schedule: distance along route → time, for each stop.
 */
export function buildSchedule(
  stops: ScheduleStop[],
  route: Point[],
  cumulativeDistances?: number[]
): SchedulePoint[] {
  const cumDist = cumulativeDistances ?? buildCumulativeDistances(route)
  const schedule: SchedulePoint[] = []

  for (const s of stops) {
    const time = s.departure ?? s.arrival
    if (time === undefined) continue

    const projection = closestPointOnPolyline(route, s.stop.position)
    const distance = distanceAlongPolyline(route, cumDist, projection)

    schedule.push({ distance, time })
  }

  return schedule
}

/**
 * Interpolate the expected distance along the route at a given timestamp.
 * Assumes constant speed between stops.
 * Returns null if timestamp is outside the schedule or schedule is too short.
 */
export function interpolateDistance(
  schedule: SchedulePoint[],
  timestamp: number
): number | null {
  if (schedule.length < 2) return null

  const first = schedule[0]!
  const last = schedule[schedule.length - 1]!

  if (timestamp <= first.time) return first.distance
  if (timestamp >= last.time) return last.distance

  for (let i = 0; i < schedule.length - 1; i++) {
    const a = schedule[i]!
    const b = schedule[i + 1]!
    if (timestamp >= a.time && timestamp <= b.time) {
      const t = (timestamp - a.time) / (b.time - a.time)
      return a.distance + t * (b.distance - a.distance)
    }
  }

  return null
}

/**
 * Expected position of the tram at a given timestamp.
 */
export function expectedPosition(
  schedule: SchedulePoint[],
  route: Point[],
  cumulativeDistances: number[],
  timestamp: number
): Point | null {
  const dist = interpolateDistance(schedule, timestamp)
  if (dist === null) return null
  return pointAtDistance(route, cumulativeDistances, dist)
}

/**
 * Expected speed of the tram at a given timestamp (m/s).
 * Computed from the schedule segment the timestamp falls in.
 */
export function expectedSpeed(
  schedule: SchedulePoint[],
  timestamp: number
): number | null {
  if (schedule.length < 2) return null

  const first = schedule[0]!
  const last = schedule[schedule.length - 1]!

  if (timestamp < first.time || timestamp > last.time) return null

  for (let i = 0; i < schedule.length - 1; i++) {
    const a = schedule[i]!
    const b = schedule[i + 1]!
    if (timestamp >= a.time && timestamp <= b.time) {
      const dt = (b.time - a.time) / 1000
      if (dt === 0) return 0
      return Math.abs(b.distance - a.distance) / dt
    }
  }

  return null
}

/**
 * How well does the user's speed match the tram's expected speed?
 * Returns a value in [0, 1]. 1 = perfect match.
 */
export function speedMatch(userSpeedMs: number, tramSpeedMs: number): number {
  if (tramSpeedMs < 0.5 && userSpeedMs < 0.5) return 1 // both stationary
  if (tramSpeedMs < 0.5 || userSpeedMs < 0.5) return 0 // one moving, one not

  const ratio = Math.min(userSpeedMs, tramSpeedMs) / Math.max(userSpeedMs, tramSpeedMs)
  return ratio
}
