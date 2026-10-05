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
          In Safari unten auf <strong>Teilen</strong> tippen (Quadrat mit Pfeil nach oben).
        </li>
        <li>
          <strong>„Zum Home-Bildschirm“</strong> wählen.
        </li>
        <li>
          Falls angezeigt, <strong>„Als Web-App öffnen“</strong> aktiviert lassen. Dann auf <strong>Hinzufügen</strong> tippen.
        </li>
      </ol>
    )
  }
  return (
    <ol className="steps">
      <li>
        Im Browser-Menü (⋮) auf <strong>„App installieren“</strong> oder <strong>„Zum Startbildschirm hinzufügen“</strong> tippen.
      </li>
      <li>Bestätigen. Endstep erscheint dann wie jede andere App.</li>
    </ol>
  )
}

/** Hinweis „Als App installieren“. Verschwindet, sobald die App installiert läuft oder weggeklickt wurde. */
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
      // ignorieren
    }
  }

  return (
    <>
      <div className="install-card">
        <span className="install-icon" aria-hidden="true">
          <DeviceMobileIcon weight="fill" />
        </span>
        <div>
          <strong>Als App installieren</strong>
          <span className="muted small">Eigenes Icon, Vollbild, offline nutzbar.</span>
        </div>
        <Button size="sm" variant="secondary" onClick={install}>
          {canPrompt ? 'Installieren' : 'So geht’s'}
        </Button>
        {compact && <IconButton icon={XIcon} label="Hinweis ausblenden" onClick={dismiss} />}
      </div>
      <BottomSheet open={showSteps} onClose={() => setShowSteps(false)} title="Als App installieren">
        <InstallSteps />
      </BottomSheet>
    </>
  )
}
