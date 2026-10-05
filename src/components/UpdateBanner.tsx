import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Meldet, wenn eine neue Version ausgerollt wurde, und aktualisiert auf Tipp. */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {})
      }
      setInterval(check, CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  if (!needRefresh) return null
  return (
    <div className="update-banner" role="status">
      <span>Neue Version verfügbar</span>
      <button type="button" className="primary" onClick={() => void updateServiceWorker(true)}>
        Aktualisieren
      </button>
    </div>
  )
}
