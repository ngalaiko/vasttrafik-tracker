/**
 * Combine individual signals into a final score for a journey candidate.
 *
 * Every intermediate value is exposed in the returned diagnostic object
 * so the UI can render a debug panel showing exactly why a journey scored
 * the way it did.
 *
 * There are no hard gates here — candidate filtering (which lines to even
 * consider) lives in useNearbyStops where it actually saves API calls.
 * Scoring is purely soft: the weighted geometric mean naturally produces
 * near-zero scores for bad matches without brittle cliff edges.
 */
import type { Point, ScheduleStop } from '$lib/types'
import { buildCumulativeDistances } from '$lib/utils'
import type { GpsSample } from '$lib/gpsHistory.svelte'

import { userMotion, type UserMotion } from './userMotion'
import {
  projectOntoLine,
  bearingMatch,
  type LineProjection,
  type BearingMatch
} from './lineProximity'
import {
  projectSamples,
  progressSpeed,
  averageLateralDistance,
  lateralDistanceStdDev
} from './lineProgress'
import {
  buildSchedule,
  expectedSpeed,
  speedMatch,
  type SchedulePoint
} from './schedulePosition'

// ---------------------------------------------------------------------------
// Diagnostic / debug types — every intermediate value is surfaced
// ---------------------------------------------------------------------------

/** Individual normalised signal in [0, 1]. */
export interface SignalValue {
  name: string
  /** Raw value before normalisation (for debug display). */
  raw: number
  /** Normalised score in [0, 1]. */
  score: number
  weight: number
}

/** Full diagnostics for one journey candidate. */
export interface ScoringDiagnostics {
  /** User motion derived from GPS history. */
  motion: UserMotion
  /** Projection of latest user position onto the route. */
  projection: LineProjection | null
  /** Bearing comparison (null if user bearing unknown). */
  bearing: BearingMatch | null
  /** Schedule built from stop calls. */
  schedule: SchedulePoint[]
  /** Expected tram speed at current time (m/s). */
  expectedTramSpeed: number | null
  /** User's progress speed along the route (m/s, from regression). */
  userProgressSpeed: number | null
  /** Average lateral distance across GPS history (m). */
  avgLateralDistance: number
  /** Std dev of lateral distance (m). */
  lateralStdDev: number
  /** Individual signal scores. */
  signals: SignalValue[]
  /** Final combined score in [0, 1]. Higher = better match. */
  score: number
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Lateral distance at which the lateral score reaches 0 (meters). */
const LATERAL_MAX = 50
/** Lateral std dev at which consistency score reaches 0 (meters). */
const LATERAL_STDDEV_MAX = 30

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Linearly map value from [0, max] to [1, 0], clamped. */
function inverseLinear(value: number, max: number): number {
  return Math.max(0, Math.min(1, 1 - value / max))
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface CombineInput {
  /** Route polyline. */
  route: Point[]
  /** Stop schedule (times at each stop). */
  schedule: ScheduleStop[]
  /** User's GPS history. */
  gpsSamples: GpsSample[]
  /** Current timestamp (epoch ms). Defaults to Date.now(). */
  now?: number
}

export function combine(input: CombineInput): ScoringDiagnostics {
  const { route, schedule: scheduleStops, gpsSamples, now = Date.now() } = input

  const signals: SignalValue[] = []

  // -- User motion ----------------------------------------------------------
  const motion = userMotion(gpsSamples)

  // -- Route geometry -------------------------------------------------------
  const cumDist = buildCumulativeDistances(route)

  // -- Projection (latest position) -----------------------------------------
  const latestSample = gpsSamples.length > 0 ? gpsSamples[gpsSamples.length - 1]! : null
  const projection = latestSample && route.length >= 2
    ? projectOntoLine(route, latestSample.position, cumDist)
    : null

  // -- Schedule -------------------------------------------------------------
  const schedule = buildSchedule(scheduleStops, route, cumDist)
  const tramSpeed = expectedSpeed(schedule, now)

  // -- Projected samples (for progress & lateral) ---------------------------
  const projected = route.length >= 2 ? projectSamples(route, gpsSamples) : []
  const userProgSpeed = progressSpeed(projected)
  const avgLateral = averageLateralDistance(projected)
  const latStdDev = lateralDistanceStdDev(projected)

  // -- Bearing --------------------------------------------------------------
  const bearingResult =
    motion.bearing !== null && projection
      ? bearingMatch(motion.bearing, projection.lineBearing)
      : null

  // If we can't project the user onto the route, there's nothing to score.
  if (!projection) {
    return {
      motion,
      projection,
      bearing: bearingResult,
      schedule,
      expectedTramSpeed: tramSpeed,
      userProgressSpeed: userProgSpeed,
      avgLateralDistance: avgLateral,
      lateralStdDev: latStdDev,
      signals,
      score: 0
    }
  }

  // =========================================================================
  // Signals
  // =========================================================================

  // Signal: bearing alignment
  const bearingScore = bearingResult ? bearingResult.score : 0.5
  signals.push({
    name: 'bearing',
    raw: bearingResult?.angleDifference ?? -1,
    score: bearingScore,
    weight: motion.bearing !== null ? 1.0 : 0.0
  })

  // Signal: speed match (user speed vs expected tram speed)
  const speedMatchScore =
    tramSpeed !== null ? speedMatch(motion.speedMs, tramSpeed) : 0.5
  signals.push({
    name: 'speedMatch',
    raw: tramSpeed ?? -1,
    score: speedMatchScore,
    weight: tramSpeed !== null ? 1.0 : 0.0
  })

  // Signal: progress match (user's progress speed along line vs tram speed)
  let progressScore = 0.5
  if (userProgSpeed !== null && tramSpeed !== null) {
    progressScore = speedMatch(Math.abs(userProgSpeed), tramSpeed)
  }
  signals.push({
    name: 'progressMatch',
    raw: userProgSpeed ?? -1,
    score: progressScore,
    weight: userProgSpeed !== null && tramSpeed !== null ? 1.5 : 0.0
  })

  // Signal: lateral closeness
  const lateralScore = inverseLinear(avgLateral, LATERAL_MAX)
  signals.push({
    name: 'lateral',
    raw: avgLateral,
    score: lateralScore,
    weight: projected.length >= 2 ? 1.0 : 0.0
  })

  // Signal: lateral consistency
  const consistencyScore = inverseLinear(latStdDev, LATERAL_STDDEV_MAX)
  signals.push({
    name: 'lateralConsistency',
    raw: latStdDev,
    score: consistencyScore,
    weight: projected.length >= 3 ? 0.5 : 0.0
  })

  // =========================================================================
  // Combine: weighted geometric mean
  // =========================================================================

  let score = 0
  let logSum = 0
  let weightSum = 0
  for (const s of signals) {
    if (s.weight === 0) continue
    const clamped = Math.max(1e-6, s.score)
    logSum += s.weight * Math.log(clamped)
    weightSum += s.weight
  }
  score = weightSum > 0 ? Math.exp(logSum / weightSum) : 0

  return {
    motion,
    projection,
    bearing: bearingResult,
    schedule,
    expectedTramSpeed: tramSpeed,
    userProgressSpeed: userProgSpeed,
    avgLateralDistance: avgLateral,
    lateralStdDev: latStdDev,
    signals,
    score
  }
}
