/**
 * Derived signals from user position + line geometry:
 * distance to line, position along line, line bearing at user position, bearing match.
 */
import type { Point } from '$lib/types'
import {
  closestPointOnPolyline,
  distanceAlongPolyline,
  buildCumulativeDistances
} from '$lib/utils'
import { bearing, bearingDifference } from './userMotion'

export interface LineProjection {
  /** Closest point on the line to the user. */
  point: Point
  /** Distance from user to closest point on line (meters). */
  distance: number
  /** Segment index of the closest point. */
  segmentIndex: number
  /** Distance along the line from start to the projected point (meters). */
  distanceAlong: number
  /** Bearing of the line at the projected point, in the forward direction (degrees). */
  lineBearing: number
}

/**
 * Project user position onto a line, returning all proximity info.
 */
export function projectOntoLine(
  route: Point[],
  userPosition: Point,
  cumulativeDistances?: number[]
): LineProjection {
  const cumDist = cumulativeDistances ?? buildCumulativeDistances(route)
  const projection = closestPointOnPolyline(route, userPosition)
  const distanceAlong = distanceAlongPolyline(route, cumDist, projection)

  // Bearing of the line segment at the projection point
  const segStart = route[projection.segmentIndex]!
  const segEnd = route[Math.min(projection.segmentIndex + 1, route.length - 1)]!
  const lineBearing = bearing(segStart, segEnd)

  return {
    point: projection.point,
    distance: projection.distance,
    segmentIndex: projection.segmentIndex,
    distanceAlong,
    lineBearing
  }
}

/**
 * How well does the user's bearing match the line's direction?
 *
 * Returns a value in [0, 1]:
 *   1 = perfect match (same direction)
 *   0 = perpendicular or opposite
 *
 * Considers both forward and reverse directions of the line,
 * since polylines don't inherently have a direction, but returns
 * whether it matches forward or reverse.
 */
export interface BearingMatch {
  /** Score in [0, 1]. 1 = perfect alignment. */
  score: number
  /** Whether the user is moving in the forward direction of the polyline. */
  forward: boolean
  /** Angular difference to the best-matching direction (degrees, [0, 90]). */
  angleDifference: number
}

export function bearingMatch(
  userBearing: number,
  lineBearing: number
): BearingMatch {
  const forwardDiff = bearingDifference(userBearing, lineBearing)
  const reverseDiff = bearingDifference(userBearing, (lineBearing + 180) % 360)

  const forward = forwardDiff <= reverseDiff
  const angleDifference = forward ? forwardDiff : reverseDiff

  // Map [0, 90] to [1, 0]. Anything > 90° scores 0.
  const score = Math.max(0, 1 - angleDifference / 90)

  return { score, forward, angleDifference }
}
