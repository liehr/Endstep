let enabled = true

/** Settings → Vibration. */
export function setHaptics(on: boolean) {
  enabled = on
}

/** Short vibration as feedback (Android; iOS browsers don't support it). */
export function haptic(pattern: number | number[] = 8) {
  if (!enabled) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // ignore
  }
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
