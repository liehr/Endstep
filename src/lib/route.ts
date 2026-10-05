import { useSyncExternalStore } from 'react'

// Hash-Routing (#/verlauf …): funktioniert auf jedem statischen Hoster
// und die Zurück-Geste auf dem Handy verhält sich wie erwartet.

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

const current = () => window.location.hash.replace(/^#/, '') || '/'

export function useRoute(): string {
  return useSyncExternalStore(subscribe, current)
}

export function navigate(path: string, { replace = false } = {}) {
  if (replace) window.location.replace(`#${path}`)
  else window.location.hash = path
}
