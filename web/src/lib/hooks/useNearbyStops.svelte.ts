import type { Point, Route } from '$lib/types'
import lines from '$lib/lines'
import { closestPointOnPolyline } from '$lib/utils'

const MAX_LINE_DISTANCE_METERS = 50

function roundCoordinates(coords: Point, precision = 0.0001): Point {
  return [
    Math.round(coords[0] / precision) * precision,
    Math.round(coords[1] / precision) * precision
  ]
}

function getCacheKey(coords: Point): string {
  return `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`
}

const nearbyRoutesCache = new Map<string, Route[]>()

function calculateNearbyRoutes(coordinates: Point): Route[] {
  const cacheKey = getCacheKey(coordinates)

  const cached = nearbyRoutesCache.get(cacheKey)
  if (cached) return cached

  const result = lines
    .map(route => {
      const projection = closestPointOnPolyline(route.coordinates, coordinates)
      return { route, distance: projection.distance }
    })
    .filter(({ distance }) => distance < MAX_LINE_DISTANCE_METERS)
    .map(({ route }) => route)

  if (nearbyRoutesCache.size > 100) {
    nearbyRoutesCache.clear()
  }
  nearbyRoutesCache.set(cacheKey, result)

  return result
}

export function useNearbyStops(rawCoordinates: () => Point) {
  const coordinates = $derived(roundCoordinates(rawCoordinates()))
  const routes = $derived(calculateNearbyRoutes(coordinates))

  return {
    get coordinates() {
      return coordinates
    },
    get routes() {
      return routes
    }
  }
}
