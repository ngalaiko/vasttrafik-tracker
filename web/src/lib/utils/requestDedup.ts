interface RequestEntry {
  promise: Promise<unknown>
  timestamp: number
}

export class RequestDeduplicator {
  private activeRequests = new Map<string, RequestEntry>()
  private requestTTL: number

  constructor(requestTTL: number = 5000) {
    this.requestTTL = requestTTL
  }

  async dedupe<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const existing = this.activeRequests.get(key)

    // Return existing promise if still active and not expired
    if (existing && now - existing.timestamp < this.requestTTL) {
      return existing.promise as Promise<T>
    }

    // Create new request
    const entry: RequestEntry = {
      promise: requestFn().finally(() => {
        // Only clean up if this is still the active request for this key
        if (this.activeRequests.get(key) === entry) {
          this.activeRequests.delete(key)
        }
      }),
      timestamp: now
    }

    this.activeRequests.set(key, entry)

    return entry.promise as Promise<T>
  }

  clear(): void {
    this.activeRequests.clear()
  }

  // Optional: cleanup expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.activeRequests.entries()) {
      if (now - entry.timestamp >= this.requestTTL) {
        this.activeRequests.delete(key)
      }
    }
  }
}

// Global instance for app-wide deduplication with shorter TTL for real-time data
export const globalRequestDeduplicator = new RequestDeduplicator(1000) // 1 second for real-time transit data
