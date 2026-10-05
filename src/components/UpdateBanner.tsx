import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { activateUpdate } from '../lib/pwaUpdate'
import { Button } from './ui'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Announces when a new version has been rolled out and updates on tap. */
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
      <span>New version available</span>
      <Button
        size="sm"
        disabled={updating}
        onClick={() => {
          setUpdating(true)
          void activateUpdate()
        }}
      >
        {updating ? 'Loading…' : 'Update'}
      </Button>
    </div>
  )
}
