/**
 * Calculate the distance from a point to a line segment.
 * This function uses the formula for the distance from a point to a line segment.
 * @param {{lat: number, long: number}} point The point from which to calculate the distance
 * @param {{lat: number, long: number}} lineStart The start point of the line segment
 * @param {{lat: number, long: number}} lineEnd The end point of the line segment
 * @returns {number} The distance from the point to the line segment in meters
 */
export function calculateDistanceToLineSegment(point, lineStart, lineEnd) {
  /**
   * Convert geographic coordinates (latitude, longitude) to Cartesian coordinates.
   * This is a simplified conversion assuming a flat Earth model for small distances.
   * @param {{lat: number, long: number}} coord The geographic coordinate to Convert
   * @returns {{x: number, y: number}} The Cartesian coordinates
   */
  function toCartesian(coord) {
    return {
      x: coord.long * Math.cos((coord.lat * Math.PI) / 180),
      y: coord.lat,
    };
  }

  const p = toCartesian(point);
  const a = toCartesian(lineStart);
  const b = toCartesian(lineEnd);

  // Vector from lineStart to lineEnd
  const ab = { x: b.x - a.x, y: b.y - a.y };

  // Vector from lineStart to point
  const ap = { x: p.x - a.x, y: p.y - a.y };

  // Calculate the projection parameter t
  const abSquared = ab.x * ab.x + ab.y * ab.y;

  // Handle degenerate case where lineStart and lineEnd are the same
  if (abSquared === 0) {
    return calculateDistanceBetweenTwoPoints(point, lineStart);
  }

  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / abSquared));

  // Find the closest point on the line segment
  const closestPoint = {
    lat: lineStart.lat + t * (lineEnd.lat - lineStart.lat),
    long: lineStart.long + t * (lineEnd.long - lineStart.long),
  };

  // Return the distance from the point to the closest point on the segment
  return calculateDistanceBetweenTwoPoints(point, closestPoint);
}

/**
 * Calculate the distance between two points using the Haversine formula.
 * This function calculates the distance in kilometers between two points on the Earth.
 * @param {{lat: number, long: number}} a First point with latitude and longitude
 * @param {{lat: number, long: number}} b Second point with latitude and longitude
 * @returns {number} Distance in meters
 */
export function calculateDistanceBetweenTwoPoints(a, b) {
  const earthRadius = 6371000; // Earth's radius in meters

  // Convert degrees to radians
  const lat1Rad = (a.lat * Math.PI) / 180;
  const lon1Rad = (a.long * Math.PI) / 180;
  const lat2Rad = (b.lat * Math.PI) / 180;
  const lon2Rad = (b.long * Math.PI) / 180;

  // Haversine formula
  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadius * c;
}
