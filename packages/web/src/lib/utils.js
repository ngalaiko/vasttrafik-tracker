/**
 * Haversine distance between two points on the Earth.
 * @param {[number, number]} p1 First point as [lat, long]
 * @param {[number, number]} p2 Second point as [lat, long]
 * @returns {number} Distance in meters
 */
export function haversineDistance(p1, p2) {
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

/**
 * Find closest point on a line segment to a target point.
 * @param {[number, number]} segStart Start of segment
 * @param {[number, number]} segEnd End of segment
 * @param {[number, number]} target Target point
 * @returns {[number, number]} Closest point on segment
 */
function closestPointOnSegment(segStart, segEnd, target) {
  const [x1, y1] = segStart;
  const [x2, y2] = segEnd;
  const [px, py] = target;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return segStart; // Segment is a point
  }

  // Parameter t represents position along segment (0 = start, 1 = end)
  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)),
  );

  return [x1 + t * dx, y1 + t * dy];
}

/**
 * Find N closest points on a polyline to a target point.
 * Includes both vertices and points along segments.
 * @param {Array<[number, number]>} polyline Array of points as [lat, long]
 * @param {[number, number]} target Target point as [lat, long]
 * @param {number} n Number of closest points to return
 * @returns {Array<{point: [number, number], distance: number, segmentIndex?: number}>} N closest points with metadata
 */
export function closestPointsOnPolyline(polyline, target, n) {
  if (polyline.length === 0) return [];

  const candidates = [];

  // Add all vertices
  polyline.forEach((vertex, i) => {
    candidates.push({
      point: vertex,
      distance: haversineDistance(vertex, target),
      vertexIndex: i,
    });
  });

  // Add closest points on each segment
  for (let i = 0; i < polyline.length - 1; i++) {
    const segStart = polyline[i];
    const segEnd = polyline[i + 1];
    const closestOnSeg = closestPointOnSegment(segStart, segEnd, target);

    // Only add if it's not already a vertex (avoid duplicates)
    const isVertex =
      (closestOnSeg[0] === segStart[0] && closestOnSeg[1] === segStart[1]) ||
      (closestOnSeg[0] === segEnd[0] && closestOnSeg[1] === segEnd[1]);

    if (!isVertex) {
      candidates.push({
        point: closestOnSeg,
        distance: haversineDistance(closestOnSeg, target),
        segmentIndex: i,
      });
    }
  }

  // Sort by distance and return top N
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, n);
}
