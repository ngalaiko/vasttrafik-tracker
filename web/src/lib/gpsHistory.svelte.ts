import { untrack } from 'svelte'
import type { Point } from '$lib/types'

export interface GpsSample {
  position: Point
  timestamp: number
}

const MAX_AGE_MS = 60_000

export class GpsHistory {
  samples = $state.raw<GpsSample[]>([])

  add(position: Point) {
    const now = Date.now()
    // Use untrack to read current samples without creating a reactive dependency,
    // preventing infinite loops when called from an $effect.
    const current = untrack(() => this.samples)
    this.samples = [
      ...current.filter(s => now - s.timestamp < MAX_AGE_MS),
      { position, timestamp: now }
    ]
  }
}
