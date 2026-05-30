/**
 * Creates a debounced version of a function with loading protection.
 * Useful for form submission buttons to prevent double-clicks.
 *
 * Usage in templates:
 *   const submit = useSubmitLock(async () => { ... await doPost(); }, 300)
 *   <button :disabled="submit.locked" @click="submit.run">提交</button>
 */
export function useSubmitLock<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delayMs: number = 300,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let locked = false

  async function run(...args: any[]) {
    if (locked) return
    locked = true
    try {
      await fn(...args)
    } finally {
      // Clear any pending timer
      if (timer) { clearTimeout(timer); timer = null }
      // Unlock after delay
      timer = setTimeout(() => {
        locked = false
      }, delayMs)
    }
  }

  function reset() {
    locked = false
    if (timer) { clearTimeout(timer); timer = null }
  }

  return {
    run,
    reset,
    get locked() { return locked },
  }
}

/**
 * Simple debounce for non-async functions.
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number = 300,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delayMs)
  }
}
