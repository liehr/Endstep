import { isIos, isStandalone, promptInstall, useCanPromptInstall } from '../lib/install'
import { Card } from './ui'

/** Anleitung „Als App installieren“. Wird nicht angezeigt, wenn die App schon installiert läuft. */
export function InstallHint({ always = false }: { always?: boolean }) {
  const canPrompt = useCanPromptInstall()
  if (isStandalone() && !always) return null

  return (
    <Card className="install">
      <h2>Als App installieren</h2>
      {isStandalone() ? (
        <p>Endstep läuft bereits als installierte App. 👍</p>
      ) : canPrompt ? (
        <>
          <p>Ein Tipp, und Endstep liegt als App auf deinem Startbildschirm, auch offline nutzbar.</p>
          <button type="button" className="primary" onClick={() => void promptInstall()}>
            App installieren
          </button>
        </>
      ) : isIos() ? (
        <ol>
          <li>
            In Safari unten auf <strong>Teilen</strong> tippen (Quadrat mit Pfeil nach oben).
          </li>
          <li>
            <strong>„Zum Home-Bildschirm“</strong> wählen.
          </li>
          <li>
            Falls angezeigt, <strong>„Als Web-App öffnen“</strong> aktiviert lassen. Dann auf{' '}
            <strong>Hinzufügen</strong> tippen.
          </li>
        </ol>
      ) : (
        <ol>
          <li>
            Im Browser-Menü (⋮) auf <strong>„App installieren“</strong> oder{' '}
            <strong>„Zum Startbildschirm hinzufügen“</strong> tippen.
          </li>
          <li>Bestätigen. Endstep erscheint dann wie jede andere App.</li>
        </ol>
      )}
    </Card>
  )
}
