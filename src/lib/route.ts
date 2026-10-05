import { useSyncExternalStore } from 'react'

// Hash routing (#/verlauf …): works on any static host
// and the back gesture on phones behaves as expected.

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
 * Switch to a route. Notifies immediately (not only on the later hashchange
 * event) so the data change and the page change arrive in the same render and
 * no page briefly keeps running on stale assumptions.
 */
export function navigate(path: string, { replace = false } = {}) {
  if (replace) window.location.replace(`#${path}`)
  else window.location.hash = path
  emit()
}
