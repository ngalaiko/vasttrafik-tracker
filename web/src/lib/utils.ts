export type Point = [number, number]

export function distanceM(p1: Point, p2: Point): number {
  const R = 6371e3 // Radius of the Earth in meters
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180
  const dLon = ((p2[1] - p1[1]) * Math.PI) / 180
  const lat1 = (p1[0] * Math.PI) / 180
  const lat2 = (p2[0] * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export interface ClosestPoint {
  point: Point
  distance: number
  segmentIndex: number
}

export function closestPointOnPolyline(
  polyline: Array<Point>,
  target: Point
): ClosestPoint {
  if (polyline.length === 0) {
    throw new Error('Polyline cannot be empty')
  }
  if (polyline.length === 1) {
    return {
      point: polyline[0]!,
      distance: distanceM(polyline[0]!, target),
      segmentIndex: 0
    }
  }

  const candidates: ClosestPoint[] = []

  // Check each segment
  for (let i = 0; i < polyline.length - 1; i++) {
    const segStart = polyline[i]!
    const segEnd = polyline[i + 1]!
    const closestOnSeg = closestPointOnSegment(segStart, segEnd, target)

    const result: ClosestPoint = {
      point: closestOnSeg,
      distance: distanceM(closestOnSeg, target),
      segmentIndex: i
    }

    candidates.push(result)
  }

  candidates.sort((a, b) => a.distance - b.distance)
  const closest = candidates[0]
  if (!closest) {
    throw new Error('No closest point found')
  }
  return closest
}

function closestPointOnSegment(
  segStart: Point,
  segEnd: Point,
  target: Point
): Point {
  const [x1, y1] = segStart
  const [x2, y2] = segEnd
  const [px, py] = target
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) {
    return segStart // Segment is a point
  }
  // Parameter t represents position along segment (0 = start, 1 = end)
  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
  )
  return [x1 + t * dx, y1 + t * dy]
}

/**
 * Build an array of cumulative distances along a polyline.
 * Result[i] = total distance from polyline[0] to polyline[i].
 */
export function buildCumulativeDistances(polyline: Point[]): number[] {
  const distances = [0]
  for (let i = 1; i < polyline.length; i++) {
    distances.push(distances[i - 1]! + distanceM(polyline[i - 1]!, polyline[i]!))
  }
  return distances
}

/**
 * Given a projection (from closestPointOnPolyline), compute the distance
 * from the start of the polyline to the projected point.
 */
export function distanceAlongPolyline(
  polyline: Point[],
  cumulativeDistances: number[],
  projection: ClosestPoint
): number {
  const baseDistance = cumulativeDistances[projection.segmentIndex]!
  const segStart = polyline[projection.segmentIndex]!
  return baseDistance + distanceM(segStart, projection.point)
}

/**
 * Find the point on a polyline at a given cumulative distance from the start.
 */
export function pointAtDistance(
  polyline: Point[],
  cumulativeDistances: number[],
  distance: number
): Point {
  const totalLength = cumulativeDistances[cumulativeDistances.length - 1]!

  if (distance <= 0) return polyline[0]!
  if (distance >= totalLength) return polyline[polyline.length - 1]!

  for (let i = 0; i < cumulativeDistances.length - 1; i++) {
    const startDist = cumulativeDistances[i]!
    const endDist = cumulativeDistances[i + 1]!
    if (distance >= startDist && distance <= endDist) {
      const segLength = endDist - startDist
      if (segLength === 0) return polyline[i]!
      const t = (distance - startDist) / segLength
      return [
        polyline[i]![0] + t * (polyline[i + 1]![0] - polyline[i]![0]),
        polyline[i]![1] + t * (polyline[i + 1]![1] - polyline[i]![1])
      ]
    }
  }

  return polyline[polyline.length - 1]!
}
