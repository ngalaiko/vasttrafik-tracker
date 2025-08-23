export function debounce<T extends unknown[], R>(
  func: (...args: T) => R,
  wait: number
): (...args: T) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: T) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function createDebouncedState<T>(initialValue: T, delay = 300) {
  let value = $state(initialValue)
  let debouncedValue = $state(initialValue)

  const updateDebounced = debounce((newValue: T) => {
    debouncedValue = newValue
  }, delay)

  $effect(() => {
    updateDebounced(value)
  })

  return {
    get value() {
      return value
    },
    set value(newValue: T) {
      value = newValue
    },
    get debouncedValue() {
      return debouncedValue
    }
  }
}
