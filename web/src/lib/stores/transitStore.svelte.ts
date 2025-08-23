import type { StopPointApiModel } from '@vasttrafik-tracker/vasttrafik'
import { StopPointArrivals } from '$lib/stopPointArrivals.svelte'
import { JourneyDetails } from '$lib/journeyDetails.svelte'

interface CacheEntry<T> {
  value: T
  timestamp: number
  lastAccessed: number
}

class TransitStore {
  private arrivalCache = new Map<string, CacheEntry<StopPointArrivals>>()
  private journeyCache = new Map<string, CacheEntry<JourneyDetails>>()

  // Cache configuration for real-time data
  private readonly MAX_ARRIVAL_CACHE_SIZE = 50
  private readonly MAX_JOURNEY_CACHE_SIZE = 100
  private readonly CACHE_CLEANUP_INTERVAL = 30 * 1000 // 30 seconds for more aggressive cleanup
  private readonly CACHE_MAX_AGE = 2 * 60 * 1000 // 2 minutes for real-time data
  
  private cleanupInterval: number | null = null
  private lastCleanup = Date.now()

  constructor() {
    // Start periodic cleanup only in browser
    if (typeof window !== 'undefined') {
      this.cleanupInterval = window.setInterval(() => {
        this.performCleanup()
      }, this.CACHE_CLEANUP_INTERVAL)
    }
  }

  private performCleanup() {
    const now = Date.now()
    
    // Clean up expired arrival entries
    for (const [key, entry] of this.arrivalCache.entries()) {
      if (now - entry.timestamp > this.CACHE_MAX_AGE) {
        this.arrivalCache.delete(key)
      }
    }

    // Clean up expired journey entries  
    for (const [key, entry] of this.journeyCache.entries()) {
      if (now - entry.timestamp > this.CACHE_MAX_AGE) {
        this.journeyCache.delete(key)
      }
    }

    this.lastCleanup = now
  }

  private evictLRUArrivals() {
    if (this.arrivalCache.size <= this.MAX_ARRIVAL_CACHE_SIZE) return

    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of this.arrivalCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.arrivalCache.delete(oldestKey)
    }
  }

  private evictLRUJourneys() {
    if (this.journeyCache.size <= this.MAX_JOURNEY_CACHE_SIZE) return

    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of this.journeyCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.journeyCache.delete(oldestKey)
    }
  }

  getStopPointArrivals(stopGid: string): StopPointArrivals {
    const now = Date.now()
    const existing = this.arrivalCache.get(stopGid)

    if (existing) {
      existing.lastAccessed = now
      return existing.value
    }

    // Evict if cache is full
    this.evictLRUArrivals()

    const arrival = new StopPointArrivals(stopGid, { refreshInterval: 3000 }) // 3 seconds for real-time
    this.arrivalCache.set(stopGid, {
      value: arrival,
      timestamp: now,
      lastAccessed: now
    })

    return arrival
  }

  getJourneyDetails(detailsReference: string): JourneyDetails {
    const now = Date.now()
    const existing = this.journeyCache.get(detailsReference)

    if (existing) {
      existing.lastAccessed = now
      return existing.value
    }

    // Evict if cache is full
    this.evictLRUJourneys()

    const journey = new JourneyDetails(detailsReference, { refreshInterval: 3000 }) // 3 seconds for real-time
    this.journeyCache.set(detailsReference, {
      value: journey,
      timestamp: now,
      lastAccessed: now
    })

    return journey
  }

  // Preload data for stops to improve responsiveness
  preloadStops(stops: StopPointApiModel[]) {
    const now = Date.now()
    stops.forEach(stop => {
      if (!this.arrivalCache.has(stop.gid)) {
        // Only preload if we have cache space
        if (this.arrivalCache.size < this.MAX_ARRIVAL_CACHE_SIZE) {
          const arrival = new StopPointArrivals(stop.gid, { refreshInterval: 3000 }) // 3 seconds for real-time
          this.arrivalCache.set(stop.gid, {
            value: arrival,
            timestamp: now,
            lastAccessed: now
          })
        }
      }
    })
  }

  // Cleanup method for proper disposal
  destroy() {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.arrivalCache.clear()
    this.journeyCache.clear()
  }

  // Get cache statistics for debugging
  getStats() {
    return {
      arrivalCacheSize: this.arrivalCache.size,
      journeyCacheSize: this.journeyCache.size,
      maxArrivalCacheSize: this.MAX_ARRIVAL_CACHE_SIZE,
      maxJourneyCacheSize: this.MAX_JOURNEY_CACHE_SIZE
    }
  }
}

// Export singleton instance
export const transitStore = new TransitStore()
