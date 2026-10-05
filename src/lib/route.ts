import { useSyncExternalStore } from 'react'

// Hash-Routing (#/verlauf …): funktioniert auf jedem statischen Hoster
// und die Zurück-Geste auf dem Handy verhält sich wie erwartet.

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('hashchange', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('hashchange', listener)
  }
}

const current = () => window.location.hash.replace(/^#/, '') || '/'

export function useRoute(): string {
  return useSyncExternalStore(subscribe, current)
}

/**
 * Zu einer Route wechseln. Benachrichtigt sofort (nicht erst beim späteren
 * hashchange-Event), damit Datenänderung und Seitenwechsel im selben Render
 * ankommen und keine Seite kurz mit veralteten Annahmen weiterläuft.
 */
export function navigate(path: string, { replace = false } = {}) {
  if (replace) window.location.replace(`#${path}`)
  else window.location.hash = path
  emit()
}
