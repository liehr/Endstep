import { useSyncExternalStore } from 'react'
import { applySynced, getData, onLocalChange } from '../store'
import { createSyncEngine, type SyncState } from './engine'

/** Wait this long after a change before uploading, so a lesson isn't uploaded answer by answer. */
const AFTER_CHANGE_MS = 8_000
/** While the app is open, look for changes from other devices this often. */
const POLL_MS = 60_000

export const cloud = createSyncEngine({ storage: localStorage, getData, apply: applySynced })

export function useSyncState(): SyncState {
  return useSyncExternalStore(cloud.subscribe, cloud.getState)
}

/** Start syncing in the background (does nothing until a device is connected). */
export function startSync() {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending = false
  const run = () => {
    clearTimeout(timer)
    pending = false
    if (cloud.isConnected()) void cloud.sync()
  }
  onLocalChange(() => {
    if (!cloud.isConnected()) return
    pending = true
    clearTimeout(timer)
    timer = setTimeout(run, AFTER_CHANGE_MS)
  })
  // Coming back fetches what other devices did; leaving uploads a waiting change right away.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' || pending) run()
  })
  window.addEventListener('online', run)
  setInterval(() => {
    if (document.visibilityState === 'visible') run()
  }, POLL_MS)
  run()
}
