interface RequestEntry<T> {
  promise: Promise<T>
  timestamp: number
}

export class RequestDeduplicator {
  private activeRequests = new Map<string, RequestEntry<any>>()
  private requestTTL: number

  constructor(requestTTL: number = 5000) {
    this.requestTTL = requestTTL
  }

  async dedupe<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const now = Date.now()
    const existing = this.activeRequests.get(key)

    // Return existing promise if still active and not expired
    if (existing && now - existing.timestamp < this.requestTTL) {
      return existing.promise
    }

    // Create new request
    const promise = requestFn().finally(() => {
      // Clean up after request completes
      this.activeRequests.delete(key)
    })

    this.activeRequests.set(key, {
      promise,
      timestamp: now
    })

    return promise
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

// Global instance for app-wide deduplication
export const globalRequestDeduplicator = new RequestDeduplicator()