import { describe, it, expect } from 'vitest'
import {
  buildCumulativeDistances,
  distanceAlongPolyline,
  pointAtDistance,
  closestPointOnPolyline,
  type Point
} from './utils'

describe('buildCumulativeDistances', () => {
  it('returns [0] for a single point', () => {
    const result = buildCumulativeDistances([[0, 0]])
    expect(result).toEqual([0])
  })

  it('computes cumulative distances', () => {
    // Points roughly 1 degree apart in latitude ≈ 111km
    const polyline: Point[] = [
      [0, 0],
      [1, 0],
      [2, 0]
    ]
    const result = buildCumulativeDistances(polyline)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(0)
    expect(result[1]).toBeGreaterThan(100_000)
    expect(result[2]).toBeCloseTo(result[1]! * 2, -2)
  })
})

describe('distanceAlongPolyline', () => {
  it('returns 0 for projection at the start', () => {
    const polyline: Point[] = [
      [0, 0],
      [1, 0]
    ]
    const cumDist = buildCumulativeDistances(polyline)
    const projection = closestPointOnPolyline(polyline, [0, 0])
    const result = distanceAlongPolyline(polyline, cumDist, projection)
    expect(result).toBeCloseTo(0, 0)
  })

  it('returns total length for projection at the end', () => {
    const polyline: Point[] = [
      [0, 0],
      [1, 0]
    ]
    const cumDist = buildCumulativeDistances(polyline)
    const projection = closestPointOnPolyline(polyline, [1, 0])
    const result = distanceAlongPolyline(polyline, cumDist, projection)
    expect(result).toBeCloseTo(cumDist[1]!, -1)
  })
})

describe('pointAtDistance', () => {
  const polyline: Point[] = [
    [57.7, 11.9],
    [57.7, 11.95],
    [57.7, 12.0]
  ]
  const cumDist = buildCumulativeDistances(polyline)

  it('returns start point for distance 0', () => {
    const result = pointAtDistance(polyline, cumDist, 0)
    expect(result).toEqual([57.7, 11.9])
  })

  it('returns end point for distance >= total', () => {
    const result = pointAtDistance(polyline, cumDist, cumDist[2]! + 1)
    expect(result).toEqual([57.7, 12.0])
  })

  it('interpolates midpoint correctly', () => {
    const halfDist = cumDist[1]! / 2
    const result = pointAtDistance(polyline, cumDist, halfDist)
    // Should be halfway between first and second point
    expect(result[0]).toBeCloseTo(57.7, 4)
    expect(result[1]).toBeCloseTo(11.925, 3)
  })
})
