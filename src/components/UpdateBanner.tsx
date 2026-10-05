import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { activateUpdate } from '../lib/pwaUpdate'
import { Button } from './ui'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Meldet, wenn eine neue Version ausgerollt wurde, und aktualisiert auf Tipp. */
export function UpdateBanner() {
  const [updating, setUpdating] = useState(false)
  const {
    needRefresh: [needRefresh],
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
      <Button
        size="sm"
        disabled={updating}
        onClick={() => {
          setUpdating(true)
          void activateUpdate()
        }}
      >
        {updating ? 'Lädt…' : 'Aktualisieren'}
      </Button>
    </div>
  )
}
