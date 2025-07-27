interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private defaultTTL: number

  constructor(defaultTTL: number = 10000) {
    this.defaultTTL = defaultTTL
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

    // Fetch fresh data
    const data = await fetchFn()

    // Cache the result
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl
    })

    return data
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  // Optional: cleanup expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}
