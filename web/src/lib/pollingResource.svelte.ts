const DEFAULT_REFRESH_INTERVAL = 5000

export class PollingResource<T> {
  value: T = $state.raw(undefined as T)
  error = $state<Error | null>(null)
  loading = $state(false)

  #interval: number | null = null
  #initial: T

  constructor(
    fetchFn: () => Promise<T>,
    initial: T,
    opts: { refreshInterval?: number } = {}
  ) {
    this.#initial = initial
    this.value = initial

    const doFetch = () => {
      this.loading = true
      fetchFn()
        .then(data => {
          this.value = data
          this.error = null
        })
        .catch(err => {
          this.error = err
          this.value = this.#initial
        })
        .finally(() => {
          this.loading = false
        })
    }

    doFetch()

    const interval = opts.refreshInterval ?? DEFAULT_REFRESH_INTERVAL
    if (typeof window !== 'undefined') {
      this.#interval = window.setInterval(doFetch, interval)
    }
  }

  destroy() {
    if (this.#interval !== null) {
      clearInterval(this.#interval)
      this.#interval = null
    }
  }
}
