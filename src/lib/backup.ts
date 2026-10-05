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

/** Reads a backup file. Throws an error with a clear message if it doesn't fit. */
export function parseBackup(text: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not a valid backup (not JSON).')
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { app?: unknown }).app !== BACKUP_APP) {
    throw new Error('This file is not an Endstep backup.')
  }
  return sanitizeData((parsed as { data?: unknown }).data)
}

export function backupFileName(): string {
  return `endstep-backup-${today()}.json`
}

/**
 * Save the backup on the phone. Prefers the share sheet (iOS/Android)
 * so the file can be saved e.g. to Files, Drive or sent via a messenger.
 */
export async function shareOrDownload(json: string): Promise<void> {
  const name = backupFileName()
  const file = new File([json], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Endstep backup' })
      return
    } catch (err) {
      // User closed the share sheet: do nothing else.
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
