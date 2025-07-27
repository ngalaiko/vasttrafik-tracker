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

export function isPointOnPolyline(
  point: Point,
  line: Point[],
  tolerance: number = 0.0001
): boolean {
  if (line.length < 2) return false

  for (let i = 0; i < line.length - 1; i++) {
    if (isPointOnSegment(point, line[i], line[i + 1], tolerance)) {
      return true
    }
  }
  return false
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
  if (polyline.length === 1) {
    return {
      point: polyline[0],
      distance: distanceM(polyline[0], target),
      segmentIndex: 0
    }
  }

  const candidates: ClosestPoint[] = []

  // Check each segment
  for (let i = 0; i < polyline.length - 1; i++) {
    const segStart = polyline[i]
    const segEnd = polyline[i + 1]
    const closestOnSeg = closestPointOnSegment(segStart, segEnd, target)

    const result: ClosestPoint = {
      point: closestOnSeg,
      distance: distanceM(closestOnSeg, target),
      segmentIndex: i
    }

    candidates.push(result)
  }

  candidates.sort((a, b) => a.distance - b.distance)
  return candidates[0] || null
}

function isPointOnSegment(
  p: Point,
  a: Point,
  b: Point,
  tolerance: number
): boolean {
  // Check if point is within bounding box of segment
  if (!isInBoundingBox(p, a, b, tolerance)) {
    return false
  }

  // Calculate distance from point to line segment
  return distanceToSegment(p, a, b) <= tolerance
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  // For very short segments, just return distance to nearest endpoint
  const segmentDistance = distanceM(a, b)
  if (segmentDistance < 1) {
    // Less than 1 meter
    return Math.min(distanceM(p, a), distanceM(p, b))
  }

  // Use segment midpoint as projection origin
  const origin: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

  // Project to local coordinates
  const aLocal = projectToLocal(a, origin)
  const bLocal = projectToLocal(b, origin)
  const pLocal = projectToLocal(p, origin)

  // Find closest point in local coordinates
  const closestLocal = closestPointOnSegment(aLocal, bLocal, pLocal)

  // Convert back to geographic coordinates
  const closestPoint = projectToGeo(closestLocal, origin)

  // Use geographic distance for final calculation
  return distanceM(p, closestPoint)
}

function isInBoundingBox(
  p: Point,
  a: Point,
  b: Point,
  tolerance: number
): boolean {
  const minX = Math.min(a[0], b[0]) - tolerance
  const maxX = Math.max(a[0], b[0]) + tolerance
  const minY = Math.min(a[1], b[1]) - tolerance
  const maxY = Math.max(a[1], b[1]) + tolerance

  return p[0] >= minX && p[0] <= maxX && p[1] >= minY && p[1] <= maxY
}

function projectToLocal(point: Point, origin: Point): [number, number] {
  const latToM = 111320 // meters per degree latitude
  const lonToM = 111320 * Math.cos((origin[0] * Math.PI) / 180) // meters per degree longitude

  return [(point[0] - origin[0]) * latToM, (point[1] - origin[1]) * lonToM]
}

function projectToGeo(local: [number, number], origin: Point): Point {
  const latToM = 111320
  const lonToM = 111320 * Math.cos((origin[0] * Math.PI) / 180)

  return [origin[0] + local[0] / latToM, origin[1] + local[1] / lonToM]
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

export function polylineLength(polyline: Array<Point>): number {
  if (polyline.length < 2) return 0

  let totalDistance = 0
  for (let i = 0; i < polyline.length - 1; i++) {
    totalDistance += distanceM(polyline[i], polyline[i + 1])
  }
  return totalDistance
}
