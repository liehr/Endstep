/** Kurzes Vibrieren als Rückmeldung (Android; iOS-Browser unterstützen das nicht). */
export function haptic(pattern: number | number[] = 8) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // ignorieren
  }
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
