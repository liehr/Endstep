import { sanitizeData } from './data'
import { today } from './dates'
import type { AppData } from './types'

const BACKUP_APP = 'endstep'

export function createBackup(data: AppData, version: string): string {
  const { draft: _draft, ...rest } = data
  return JSON.stringify(
    { app: BACKUP_APP, appVersion: version, exportedAt: new Date().toISOString(), data: rest },
    null,
    2,
  )
}

/** Liest eine Backup-Datei. Wirft einen Fehler mit verständlicher Meldung, wenn sie nicht passt. */
export function parseBackup(text: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges Backup (kein JSON).')
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { app?: unknown }).app !== BACKUP_APP) {
    throw new Error('Die Datei ist kein Endstep-Backup.')
  }
  return sanitizeData((parsed as { data?: unknown }).data)
}

export function backupFileName(): string {
  return `endstep-backup-${today()}.json`
}

/**
 * Backup auf dem Handy sichern. Bevorzugt das Teilen-Menü (iOS/Android),
 * damit die Datei z. B. in Dateien, Drive oder per Messenger gespeichert werden kann.
 */
export async function shareOrDownload(json: string): Promise<void> {
  const name = backupFileName()
  const file = new File([json], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Endstep-Backup' })
      return
    } catch (err) {
      // Nutzer hat das Teilen-Menü geschlossen: nichts weiter tun.
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
