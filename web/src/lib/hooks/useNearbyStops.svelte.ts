import type { Point } from '$lib/utils'
import type { StopPoint } from '@vasttrafik-tracker/vasttrafik'
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

const nearbyStopsCache = new Map<string, StopPoint[]>()

function calculateNearbyStops(coordinates: Point): StopPoint[] {
  const cacheKey = getCacheKey(coordinates)

  const cached = nearbyStopsCache.get(cacheKey)
  if (cached) return cached

  const result = lines
    .map(line => {
      const currentProjection = closestPointOnPolyline(
        line.coordinates,
        coordinates
      )
      return {
        ...line,
        currentProjection,
        distance: currentProjection.distance
      }
    })
    .filter(line => line.distance < MAX_LINE_DISTANCE_METERS)
    .map(line => {
      const segmentAfterCurrentPoint = line.coordinates.slice(
        line.currentProjection.segmentIndex + 1
      )
      const nextStopPoint =
        (segmentAfterCurrentPoint.length >= 1
          ? line.stopPoints.find(stop => {
              const projection = closestPointOnPolyline(
                segmentAfterCurrentPoint,
                [stop.latitude, stop.longitude]
              )
              return projection.distance < 15 // meters
            })
          : undefined) ?? line.stopPoints[line.stopPoints.length - 1]
      return nextStopPoint
    })
    .filter(
      (stopPoint): stopPoint is StopPoint => stopPoint !== undefined
    )

  if (nearbyStopsCache.size > 100) {
    nearbyStopsCache.clear()
  }
  nearbyStopsCache.set(cacheKey, result)

  return result
}

export function useNearbyStops(rawCoordinates: () => Point) {
  const coordinates = $derived(roundCoordinates(rawCoordinates()))
  const stops = $derived(calculateNearbyStops(coordinates))

  return {
    get coordinates() {
      return coordinates
    },
    get stops() {
      return stops
    }
  }
}
