import { describe, it, expect } from 'vitest'
import {
  bearing,
  bearingDifference,
  speedBetween,
  classifyMovement,
  userMotion
} from './userMotion'
import type { GpsSample } from '$lib/gpsHistory.svelte'
describe('bearing', () => {
  it('returns ~0 for due north', () => {
    const b = bearing([57.0, 11.0], [58.0, 11.0])
    expect(b).toBeCloseTo(0, 0)
  })

  it('returns ~90 for due east', () => {
    const b = bearing([57.0, 11.0], [57.0, 12.0])
    expect(b).toBeCloseTo(90, 0)
  })

  it('returns ~180 for due south', () => {
    const b = bearing([58.0, 11.0], [57.0, 11.0])
    expect(b).toBeCloseTo(180, 0)
  })

  it('returns ~270 for due west', () => {
    const b = bearing([57.0, 12.0], [57.0, 11.0])
    expect(b).toBeCloseTo(270, 0)
  })
})

describe('bearingDifference', () => {
  it('returns 0 for same bearing', () => {
    expect(bearingDifference(90, 90)).toBe(0)
  })

  it('returns 180 for opposite bearings', () => {
    expect(bearingDifference(0, 180)).toBe(180)
  })

  it('handles wraparound (350 vs 10)', () => {
    expect(bearingDifference(350, 10)).toBeCloseTo(20, 5)
  })

  it('handles wraparound (10 vs 350)', () => {
    expect(bearingDifference(10, 350)).toBeCloseTo(20, 5)
  })

  it('returns 90 for perpendicular', () => {
    expect(bearingDifference(0, 90)).toBeCloseTo(90, 5)
  })
})

describe('speedBetween', () => {
  it('returns 0 for same position', () => {
    const a: GpsSample = { position: [57.7, 11.9], timestamp: 0 }
    const b: GpsSample = { position: [57.7, 11.9], timestamp: 1000 }
    expect(speedBetween(a, b)).toBe(0)
  })

  it('computes reasonable speed', () => {
    // ~111m apart (0.001 degree lat ≈ 111m), 10 seconds → ~11 m/s
    const a: GpsSample = { position: [57.7, 11.9], timestamp: 0 }
    const b: GpsSample = { position: [57.701, 11.9], timestamp: 10_000 }
    const speed = speedBetween(a, b)
    expect(speed).toBeGreaterThan(10)
    expect(speed).toBeLessThan(13)
  })

  it('returns 0 for zero time delta', () => {
    const a: GpsSample = { position: [57.7, 11.9], timestamp: 0 }
    const b: GpsSample = { position: [57.701, 11.9], timestamp: 0 }
    expect(speedBetween(a, b)).toBe(0)
  })
})

describe('classifyMovement', () => {
  it('stationary below 0.5 m/s', () => {
    expect(classifyMovement(0)).toBe('stationary')
    expect(classifyMovement(0.4)).toBe('stationary')
  })

  it('walking between 0.5 and 3 m/s', () => {
    expect(classifyMovement(0.5)).toBe('walking')
    expect(classifyMovement(1.5)).toBe('walking')
    expect(classifyMovement(2.9)).toBe('walking')
  })

  it('vehicle above 3 m/s', () => {
    expect(classifyMovement(3)).toBe('vehicle')
    expect(classifyMovement(15)).toBe('vehicle')
  })
})

describe('userMotion', () => {
  const NOW = 1000000

  it('returns stationary for empty samples', () => {
    const result = userMotion([])
    expect(result.speedMs).toBe(0)
    expect(result.bearing).toBeNull()
    expect(result.classification).toBe('stationary')
  })

  it('returns stationary for single sample', () => {
    const result = userMotion([{ position: [57.7, 11.9], timestamp: NOW }])
    expect(result.classification).toBe('stationary')
  })

  it('detects vehicle speed for fast movement', () => {
    // Move ~500m east in 10 seconds ≈ 50 m/s
    const samples: GpsSample[] = [
      { position: [57.7, 11.9], timestamp: NOW },
      { position: [57.7, 11.909], timestamp: NOW + 10_000 }
    ]
    const result = userMotion(samples)
    expect(result.classification).toBe('vehicle')
    expect(result.speedMs).toBeGreaterThan(3)
    // Should be heading roughly east
    expect(result.bearing).not.toBeNull()
    expect(result.bearing!).toBeGreaterThan(60)
    expect(result.bearing!).toBeLessThan(120)
  })

  it('returns null bearing when barely moving', () => {
    // Two points < 5m apart
    const samples: GpsSample[] = [
      { position: [57.7, 11.9], timestamp: NOW },
      { position: [57.7, 11.90004], timestamp: NOW + 10_000 }
    ]
    const result = userMotion(samples)
    expect(result.bearing).toBeNull()
  })

  it('picks samples with sufficient time gap', () => {
    // First sample far back, then a cluster of recent samples
    const samples: GpsSample[] = [
      { position: [57.7, 11.9], timestamp: NOW },
      { position: [57.7, 11.905], timestamp: NOW + 5000 },
      { position: [57.7, 11.905], timestamp: NOW + 5100 }, // too close to prev
      { position: [57.7, 11.905], timestamp: NOW + 5200 } // too close to prev
    ]
    const result = userMotion(samples)
    // Should use first and last sample since they have enough gap
    expect(result.classification).not.toBe('stationary')
  })
})
