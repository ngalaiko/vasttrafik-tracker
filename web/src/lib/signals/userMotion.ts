/**
 * Derived signals from user GPS samples: speed, bearing, movement classification.
 */
import type { Point } from '$lib/types'
import { distanceM } from '$lib/utils'
import type { GpsSample } from '$lib/gpsHistory.svelte'

/** Bearing in degrees [0, 360) from point A to point B. 0 = north, 90 = east. */
export function bearing(from: Point, to: Point): number {
  const lat1 = (from[0] * Math.PI) / 180
  const lat2 = (to[0] * Math.PI) / 180
  const dLon = ((to[1] - from[1]) * Math.PI) / 180

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Smallest angle between two bearings, in degrees [0, 180]. */
export function bearingDifference(a: number, b: number): number {
  const diff = Math.abs(((a - b + 540) % 360) - 180)
  return diff
}

/** Speed in m/s between two GPS samples. */
export function speedBetween(a: GpsSample, b: GpsSample): number {
  const dt = Math.abs(b.timestamp - a.timestamp)
  if (dt === 0) return 0
  return distanceM(a.position, b.position) / (dt / 1000)
}

export type MovementClass = 'stationary' | 'walking' | 'vehicle'

/** Classify movement based on speed in m/s. */
export function classifyMovement(speedMs: number): MovementClass {
  if (speedMs < 0.5) return 'stationary'
  if (speedMs < 3) return 'walking'
  return 'vehicle'
}

export interface UserMotion {
  /** Speed in m/s, averaged over recent samples. */
  speedMs: number
  /** Bearing in degrees [0, 360). null if stationary / insufficient data. */
  bearing: number | null
  /** Movement classification. */
  classification: MovementClass
}

/**
 * Compute user motion from GPS samples.
 * Uses the last two samples with sufficient time gap.
 */
export function userMotion(samples: GpsSample[]): UserMotion {
  if (samples.length < 2) {
    return { speedMs: 0, bearing: null, classification: 'stationary' }
  }

  // Use last two samples separated by at least 500ms
  let a: GpsSample | null = null
  let b: GpsSample = samples[samples.length - 1]!

  for (let i = samples.length - 2; i >= 0; i--) {
    if (b.timestamp - samples[i]!.timestamp >= 500) {
      a = samples[i]!
      break
    }
  }

  if (!a) {
    // All samples too close in time, use first and last
    a = samples[0]!
  }

  const dt = b.timestamp - a.timestamp
  if (dt === 0) {
    return { speedMs: 0, bearing: null, classification: 'stationary' }
  }

  const speedMs = distanceM(a.position, b.position) / (dt / 1000)
  const classification = classifyMovement(speedMs)

  // Only compute bearing if we've moved enough (> 5m) to get a reliable direction
  const dist = distanceM(a.position, b.position)
  const userBearing = dist > 5 ? bearing(a.position, b.position) : null

  return { speedMs, bearing: userBearing, classification }
}
