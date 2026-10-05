import { DeviceMobileIcon, XIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { isIos, isStandalone, promptInstall, useCanPromptInstall } from '../lib/install'
import { BottomSheet, Button, IconButton } from './ui'

const DISMISS_KEY = 'endstep:install-hint-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function InstallSteps() {
  if (isIos()) {
    return (
      <ol className="steps">
        <li>
          In Safari, tap <strong>Share</strong> at the bottom (square with an arrow pointing up).
        </li>
        <li>
          Choose <strong>"Add to Home Screen"</strong>.
        </li>
        <li>
          If shown, leave <strong>"Open as Web App"</strong> turned on. Then tap <strong>Add</strong>.
        </li>
      </ol>
    )
  }
  return (
    <ol className="steps">
      <li>
        In the browser menu (⋮), tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
      </li>
      <li>Confirm. Endstep then shows up like any other app.</li>
    </ol>
  )
}

/** "Install as app" hint. Disappears once the app runs installed or the hint was dismissed. */
export function InstallHint({ compact = false }: { compact?: boolean }) {
  const canPrompt = useCanPromptInstall()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [showSteps, setShowSteps] = useState(false)

  if (isStandalone() || (compact && dismissed)) return null

  const install = () => (canPrompt ? void promptInstall() : setShowSteps(true))
  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="install-card">
        <span className="install-icon" aria-hidden="true">
          <DeviceMobileIcon weight="fill" />
        </span>
        <div>
          <strong>Install as app</strong>
          <span className="muted small">Own icon, full screen, works offline.</span>
        </div>
        <Button size="sm" variant="secondary" onClick={install}>
          {canPrompt ? 'Install' : 'How to'}
        </Button>
        {compact && <IconButton icon={XIcon} label="Hide hint" onClick={dismiss} />}
      </div>
      <BottomSheet open={showSteps} onClose={() => setShowSteps(false)} title="Install as app">
        <InstallSteps />
      </BottomSheet>
    </>
  )
}
