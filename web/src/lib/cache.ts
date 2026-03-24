interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private defaultTTL: number
  private maxSize: number

  constructor(defaultTTL: number = 10000, maxSize: number = 1000) {
    this.defaultTTL = defaultTTL
    this.maxSize = maxSize
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
      return entry.data
    }

    // Lazy cleanup: evict expired entries when cache is full
    if (this.cache.size >= this.maxSize) {
      this.cleanup()
    }

    // Still full after cleanup — evict oldest
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    const data = await fetchFn()

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })

    return data
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}
