import { describe, it, expect } from 'vitest'
import {
  projectSamples,
  progressSpeed,
  averageLateralDistance,
  lateralDistanceStdDev
} from './lineProgress'
import type { GpsSample } from '$lib/gpsHistory.svelte'
import type { Point } from '$lib/types'

// Straight east-west route at lat 57.7
const route: Point[] = [
  [57.7, 11.9],
  [57.7, 11.95],
  [57.7, 12.0]
]

const NOW = 1_000_000

describe('projectSamples', () => {
  it('projects samples onto the route', () => {
    const samples: GpsSample[] = [
      { position: [57.7, 11.92], timestamp: NOW },
      { position: [57.7, 11.94], timestamp: NOW + 5000 }
    ]
    const projected = projectSamples(route, samples)
    expect(projected).toHaveLength(2)
    expect(projected[0]!.projection.distance).toBeLessThan(1)
    expect(projected[1]!.projection.distanceAlong).toBeGreaterThan(
      projected[0]!.projection.distanceAlong
    )
  })
})

describe('progressSpeed', () => {
  it('returns null for insufficient data', () => {
    expect(progressSpeed([])).toBeNull()
    const single = projectSamples(route, [
      { position: [57.7, 11.92], timestamp: NOW }
    ])
    expect(progressSpeed(single)).toBeNull()
  })

  it('computes positive speed for forward movement along line', () => {
    // User moving east along the line over 10 seconds
    const samples: GpsSample[] = [
      { position: [57.7, 11.92], timestamp: NOW },
      { position: [57.7, 11.93], timestamp: NOW + 5000 },
      { position: [57.7, 11.94], timestamp: NOW + 10_000 }
    ]
    const projected = projectSamples(route, samples)
    const speed = progressSpeed(projected)!
    expect(speed).toBeGreaterThan(50) // moving at significant speed
  })

  it('computes negative speed for reverse movement', () => {
    // User moving west (reverse) along the line
    const samples: GpsSample[] = [
      { position: [57.7, 11.94], timestamp: NOW },
      { position: [57.7, 11.93], timestamp: NOW + 5000 },
      { position: [57.7, 11.92], timestamp: NOW + 10_000 }
    ]
    const projected = projectSamples(route, samples)
    const speed = progressSpeed(projected)!
    expect(speed).toBeLessThan(-50)
  })

  it('returns ~0 speed for stationary user', () => {
    const samples: GpsSample[] = [
      { position: [57.7, 11.93], timestamp: NOW },
      { position: [57.7, 11.93], timestamp: NOW + 5000 },
      { position: [57.7, 11.93], timestamp: NOW + 10_000 }
    ]
    const projected = projectSamples(route, samples)
    const speed = progressSpeed(projected)!
    expect(Math.abs(speed)).toBeLessThan(1)
  })
})

describe('averageLateralDistance', () => {
  it('returns Infinity for empty', () => {
    expect(averageLateralDistance([])).toBe(Infinity)
  })

  it('returns ~0 for samples on the line', () => {
    const samples: GpsSample[] = [
      { position: [57.7, 11.92], timestamp: NOW },
      { position: [57.7, 11.94], timestamp: NOW + 5000 }
    ]
    const projected = projectSamples(route, samples)
    expect(averageLateralDistance(projected)).toBeLessThan(1)
  })

  it('returns ~111m for samples 0.001° off the line', () => {
    const samples: GpsSample[] = [
      { position: [57.701, 11.92], timestamp: NOW },
      { position: [57.701, 11.94], timestamp: NOW + 5000 }
    ]
    const projected = projectSamples(route, samples)
    const avg = averageLateralDistance(projected)
    expect(avg).toBeGreaterThan(100)
    expect(avg).toBeLessThan(120)
  })
})

describe('lateralDistanceStdDev', () => {
  it('returns 0 for fewer than 2 samples', () => {
    expect(lateralDistanceStdDev([])).toBe(0)
  })

  it('returns ~0 for consistent distance', () => {
    // All samples same distance from line
    const samples: GpsSample[] = [
      { position: [57.701, 11.92], timestamp: NOW },
      { position: [57.701, 11.93], timestamp: NOW + 3000 },
      { position: [57.701, 11.94], timestamp: NOW + 6000 }
    ]
    const projected = projectSamples(route, samples)
    expect(lateralDistanceStdDev(projected)).toBeLessThan(5)
  })

  it('returns high value for varying distance', () => {
    // Samples alternating close and far from line
    const samples: GpsSample[] = [
      { position: [57.7, 11.92], timestamp: NOW }, // on line
      { position: [57.703, 11.93], timestamp: NOW + 3000 }, // ~333m off
      { position: [57.7, 11.94], timestamp: NOW + 6000 } // on line
    ]
    const projected = projectSamples(route, samples)
    expect(lateralDistanceStdDev(projected)).toBeGreaterThan(50)
  })
})
