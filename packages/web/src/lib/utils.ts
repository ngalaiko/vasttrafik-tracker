export type Point = [number, number];

export function distance(p1: Point, p2: Point): number {
  const R = 6371e3; // Radius of the Earth in meters
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
  const dLon = ((p2[1] - p1[1]) * Math.PI) / 180;
  const lat1 = (p1[0] * Math.PI) / 180;
  const lat2 = (p2[0] * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isPointOnPolyline(
  point: Point,
  line: Point[],
  tolerance: number = 0.0001
): boolean {
  if (line.length < 2) return false;

  for (let i = 0; i < line.length - 1; i++) {
    if (isPointOnSegment(point, line[i], line[i + 1], tolerance)) {
      return true;
    }
  }
  return false;
}

function isPointOnSegment(p: Point, a: Point, b: Point, tolerance: number): boolean {
  // Check if point is within bounding box of segment
  if (!isInBoundingBox(p, a, b, tolerance)) {
    return false;
  }

  // Calculate distance from point to line segment
  return distanceToSegment(p, a, b) <= tolerance;
}

function isInBoundingBox(p: Point, a: Point, b: Point, tolerance: number): boolean {
  const minX = Math.min(a[0], b[0]) - tolerance;
  const maxX = Math.max(a[0], b[0]) + tolerance;
  const minY = Math.min(a[1], b[1]) - tolerance;
  const maxY = Math.max(a[1], b[1]) + tolerance;

  return p[0] >= minX && p[0] <= maxX && p[1] >= minY && p[1] <= maxY;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  // Vector from a to b
  const abX = b[0] - a[0];
  const abY = b[1] - a[1];

  // Vector from a to p
  const apX = p[0] - a[0];
  const apY = p[1] - a[1];

  // Dot product of AB and AP
  const abDotAp = abX * apX + abY * apY;

  // Squared length of AB
  const abLenSq = abX * abX + abY * abY;

  // Handle degenerate case (zero-length segment)
  if (abLenSq === 0) {
    return Math.sqrt(apX * apX + apY * apY);
  }

  // Parameter t represents position along the segment
  let t = abDotAp / abLenSq;

  // Clamp t to [0, 1] to stay within segment bounds
  t = Math.max(0, Math.min(1, t));

  // Find closest point on segment
  const closestX = a[0] + t * abX;
  const closestY = a[1] + t * abY;

  // Return distance from p to closest point
  const dx = p[0] - closestX;
  const dy = p[1] - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

function closestPointOnSegment(segStart: Point, segEnd: Point, target: Point): Point {
  const [x1, y1] = segStart;
  const [x2, y2] = segEnd;
  const [px, py] = target;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return segStart; // Segment is a point
  }

  // Parameter t represents position along segment (0 = start, 1 = end)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));

  return [x1 + t * dx, y1 + t * dy];
}

export interface ClosestPoint {
  point: Point;
  distance: number;
  segmentIndex: number;
}

export function closestPointOnPolyline(polyline: Array<Point>, target: Point): ClosestPoint {
  if (polyline.length === 1) {
    return {
      point: polyline[0],
      distance: distance(polyline[0], target),
      segmentIndex: 0,
    };
  }

  const candidates: ClosestPoint[] = [];

  // Check each segment
  for (let i = 0; i < polyline.length - 1; i++) {
    const segStart = polyline[i];
    const segEnd = polyline[i + 1];
    const closestOnSeg = closestPointOnSegment(segStart, segEnd, target);

    const result: ClosestPoint = {
      point: closestOnSeg,
      distance: distance(closestOnSeg, target),
      segmentIndex: i,
    };

    candidates.push(result);
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0] || null;
}
