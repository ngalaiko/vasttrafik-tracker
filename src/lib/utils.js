/**
 * Calculate the distance between two points using the Haversine formula.
 * This function calculates the distance in kilometers between two points on the Earth
 *
 * @param {{lat: number, long: number}} a - First point with latitude and longitude.
 * @param {{lat: number, long: number}} b - Second point with latitude and longitude.
 * @returns {number} - Distance in meters.
 */
export function calculateDistanceMeters(a, b) {
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
