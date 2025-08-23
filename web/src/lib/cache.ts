interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
}

export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private defaultTTL: number
  private maxSize: number
  private cleanupInterval: number | null = null

  constructor(defaultTTL: number = 10000, maxSize: number = 1000) {
    this.defaultTTL = defaultTTL
    this.maxSize = maxSize
    this.startPeriodicCleanup()
  }

  async get(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const now = Date.now()
    const entry = this.cache.get(key)

    // Return cached if valid
    if (entry && now - entry.timestamp < entry.ttl) {
      entry.accessCount++
      entry.lastAccessed = now
      return entry.data
    }

    // Evict least recently used if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    // Fetch fresh data
    const data = await fetchFn()

    // Cache the result
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
      accessCount: 1,
      lastAccessed: now
    })

    return data
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  // Evict least recently used entries
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  // Start periodic cleanup of expired entries
  private startPeriodicCleanup(): void {
    if (typeof window !== 'undefined') {
      this.cleanupInterval = window.setInterval(() => {
        this.cleanup()
      }, this.defaultTTL)
    }
  }

  // Stop periodic cleanup (for proper cleanup)
  destroy(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache statistics
  getStats(): {
    size: number
    hitRate: number
    entries: Array<{ key: string; accessCount: number; age: number }>
  } {
    const now = Date.now()
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      age: now - entry.timestamp
    }))

    const totalAccess = entries.reduce((sum, e) => sum + e.accessCount, 0)
    const hitRate = totalAccess > 0 ? totalAccess / (totalAccess + entries.length) : 0

    return {
      size: this.cache.size,
      hitRate,
      entries
    }
  }
}
