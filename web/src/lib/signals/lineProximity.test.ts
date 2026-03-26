import { describe, it, expect } from 'vitest'
import { projectOntoLine, bearingMatch } from './lineProximity'
import type { Point } from '$lib/types'

describe('projectOntoLine', () => {
  // Straight east-west line at lat 57.7
  const route: Point[] = [
    [57.7, 11.9],
    [57.7, 11.95],
    [57.7, 12.0]
  ]

  it('projects a point on the line to distance ~0', () => {
    const result = projectOntoLine(route, [57.7, 11.925])
    expect(result.distance).toBeLessThan(1) // essentially on the line
  })

  it('computes distance for a point off the line', () => {
    // ~111m north of the line (0.001 deg lat)
    const result = projectOntoLine(route, [57.701, 11.925])
    expect(result.distance).toBeGreaterThan(100)
    expect(result.distance).toBeLessThan(120)
  })

  it('computes distanceAlong correctly at midpoint', () => {
    const result = projectOntoLine(route, [57.7, 11.95])
    const total = projectOntoLine(route, [57.7, 12.0])
    // Should be roughly half the total length
    expect(result.distanceAlong).toBeCloseTo(total.distanceAlong / 2, -2)
  })

  it('returns 0 distanceAlong at start', () => {
    const result = projectOntoLine(route, [57.7, 11.9])
    expect(result.distanceAlong).toBeCloseTo(0, 0)
  })

  it('line bearing is roughly east (~90°)', () => {
    const result = projectOntoLine(route, [57.7, 11.925])
    expect(result.lineBearing).toBeGreaterThan(80)
    expect(result.lineBearing).toBeLessThan(100)
  })

  it('line bearing follows segment direction for curved route', () => {
    // Route that goes north then east
    const curved: Point[] = [
      [57.7, 11.9],
      [57.71, 11.9], // north
      [57.71, 11.95] // then east
    ]
    // Point near the first segment (going north)
    const r1 = projectOntoLine(curved, [57.705, 11.9])
    expect(r1.lineBearing).toBeCloseTo(0, -1) // ~north

    // Point near the second segment (going east)
    const r2 = projectOntoLine(curved, [57.71, 11.925])
    expect(r2.lineBearing).toBeGreaterThan(80)
    expect(r2.lineBearing).toBeLessThan(100)
  })
})

describe('bearingMatch', () => {
  it('perfect forward match scores 1', () => {
    const result = bearingMatch(90, 90)
    expect(result.score).toBeCloseTo(1)
    expect(result.forward).toBe(true)
    expect(result.angleDifference).toBeCloseTo(0)
  })

  it('perfect reverse match scores 1', () => {
    const result = bearingMatch(270, 90)
    expect(result.score).toBeCloseTo(1)
    expect(result.forward).toBe(false)
    expect(result.angleDifference).toBeCloseTo(0)
  })

  it('perpendicular scores 0', () => {
    const result = bearingMatch(0, 90)
    expect(result.score).toBeCloseTo(0)
    expect(result.angleDifference).toBeCloseTo(90)
  })

  it('45° off scores 0.5', () => {
    const result = bearingMatch(45, 90)
    expect(result.score).toBeCloseTo(0.5, 1)
    expect(result.angleDifference).toBeCloseTo(45)
  })

  it('handles wraparound correctly', () => {
    // User heading 350, line heading 10 → 20° difference → forward
    const result = bearingMatch(350, 10)
    expect(result.score).toBeGreaterThan(0.7)
    expect(result.forward).toBe(true)
    expect(result.angleDifference).toBeCloseTo(20)
  })

  it('distinguishes forward from reverse', () => {
    // User heading 95, line heading 90 → forward
    const fwd = bearingMatch(95, 90)
    expect(fwd.forward).toBe(true)

    // User heading 275, line heading 90 → reverse (user going ~west on east line)
    const rev = bearingMatch(275, 90)
    expect(rev.forward).toBe(false)
  })
})
