/**
 * Derived signals from user GPS over time + line geometry:
 * progress along line, lateral drift, progress speed.
 */
import type { Point } from '$lib/types'
import { buildCumulativeDistances } from '$lib/utils'
import type { GpsSample } from '$lib/gpsHistory.svelte'
import { projectOntoLine, type LineProjection } from './lineProximity'

export interface ProjectedSample {
  timestamp: number
  projection: LineProjection
}

/**
 * Project each GPS sample onto a route, returning projected samples.
 */
export function projectSamples(
  route: Point[],
  samples: GpsSample[]
): ProjectedSample[] {
  const cumDist = buildCumulativeDistances(route)
  return samples.map(s => ({
    timestamp: s.timestamp,
    projection: projectOntoLine(route, s.position, cumDist)
  }))
}

/**
 * Compute the user's speed along the line (m/s) from projected samples.
 * Positive = moving in the forward direction of the polyline.
 * Uses linear regression for robustness against GPS noise.
 *
 * Returns null if insufficient data.
 */
export function progressSpeed(projected: ProjectedSample[]): number | null {
  if (projected.length < 2) return null

  const first = projected[0]!
  const last = projected[projected.length - 1]!
  const dt = (last.timestamp - first.timestamp) / 1000
  if (dt < 0.5) return null

  // Simple linear regression: distanceAlong vs time
  const n = projected.length
  let sumT = 0
  let sumD = 0
  let sumTT = 0
  let sumTD = 0

  for (const s of projected) {
    const t = (s.timestamp - first.timestamp) / 1000
    const d = s.projection.distanceAlong
    sumT += t
    sumD += d
    sumTT += t * t
    sumTD += t * d
  }

  const denom = n * sumTT - sumT * sumT
  if (Math.abs(denom) < 1e-10) return null

  // Slope = speed along line in m/s
  return (n * sumTD - sumT * sumD) / denom
}

/**
 * Average lateral distance (meters) from the line across all samples.
 * Low values = user is consistently close to the line.
 */
export function averageLateralDistance(projected: ProjectedSample[]): number {
  if (projected.length === 0) return Infinity
  const sum = projected.reduce((acc, s) => acc + s.projection.distance, 0)
  return sum / projected.length
}

/**
 * Standard deviation of lateral distance.
 * Low = consistent distance (on the vehicle or walking parallel).
 * High = erratic (crossing the line, GPS bouncing).
 */
export function lateralDistanceStdDev(projected: ProjectedSample[]): number {
  if (projected.length < 2) return 0
  const avg = averageLateralDistance(projected)
  const variance =
    projected.reduce(
      (acc, s) => acc + (s.projection.distance - avg) ** 2,
      0
    ) / projected.length
  return Math.sqrt(variance)
}
