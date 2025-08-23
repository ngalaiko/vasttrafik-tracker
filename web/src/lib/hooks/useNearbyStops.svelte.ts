import type { Point } from '$lib/utils'
import type { StopPointApiModel } from '@vasttrafik-tracker/vasttrafik'
import lines from '$lib/lines'
import { closestPointOnPolyline, isPointOnPolyline } from '$lib/utils'
import { createDebouncedState } from '$lib/utils/debounce.svelte'
import { coordinateCache } from '$lib/utils/cache'

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

function stopsEqual(a: StopPointApiModel[], b: StopPointApiModel[]): boolean {
  if (a.length !== b.length) return false
  return a.every((stop, i) => stop.gid === b[i]?.gid)
}

function calculateNearbyStops(coordinates: Point): StopPointApiModel[] {
  const cacheKey = getCacheKey(coordinates)

  if (coordinateCache.has(cacheKey)) {
    return coordinateCache.get(cacheKey)!
  }

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
        line.stopPoints
          .filter(stop =>
            isPointOnPolyline(
              [stop.latitude, stop.longitude],
              segmentAfterCurrentPoint
            )
          )
          .at(0) ?? line.stopPoints[line.stopPoints.length - 1]
      return nextStopPoint
    })
    .filter(
      (stopPoint): stopPoint is StopPointApiModel => stopPoint !== undefined
    )

  // Cache with cleanup to prevent memory leaks
  if (coordinateCache.size > 100) {
    coordinateCache.clear()
  }
  coordinateCache.set(cacheKey, result)

  return result
}

export function useNearbyStops(rawCoordinates: () => Point) {
  const coordinates = $derived(roundCoordinates(rawCoordinates()))

  const debouncedCoords = createDebouncedState(
    roundCoordinates(rawCoordinates()),
    200
  )

  // Update debounced coordinates when coordinates change
  $effect(() => {
    debouncedCoords.value = coordinates
  })

  let selectedStops = $state<StopPointApiModel[]>([])

  const closestLines = $derived(
    calculateNearbyStops(debouncedCoords.debouncedValue)
  )

  $effect(() => {
    if (!stopsEqual(closestLines, selectedStops)) {
      selectedStops = [...closestLines]
    }
  })

  return {
    get coordinates() {
      return coordinates
    },
    get stops() {
      return selectedStops
    }
  }
}
