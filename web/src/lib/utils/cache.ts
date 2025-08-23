import type { StopPointApiModel } from '@vasttrafik-tracker/vasttrafik'

// Module-level cache for expensive calculations (intentionally not reactive)
export const coordinateCache = new Map<string, StopPointApiModel[]>()
