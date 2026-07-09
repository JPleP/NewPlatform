import { useEffect, useRef, useCallback } from 'react'

/**
 * Runs `fn` immediately and then on a fixed interval.
 * Cleans up on unmount or when `enabled` becomes false.
 *
 * Uses `useRef` to avoid stale closures without causing re-subscribes.
 */
export const usePolling = (
  fn: () => Promise<void> | void,
  intervalMs: number,
  enabled = true,
): void => {
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const tick = async () => {
      if (!cancelled) {
        try { await fnRef.current() } catch (e) { console.error('[polling]', e) }
      }
    }

    void tick()
    const id = setInterval(tick, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [intervalMs, enabled])
}

/**
 * Debounce a callback by `delay` ms.
 */
export const useDebounce = <T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number,
): ((...args: T) => void) => {
  const timer = useRef<ReturnType<typeof setTimeout>>()
  return useCallback(
    (...args: T) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => fn(...args), delay)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [delay],
  )
}
