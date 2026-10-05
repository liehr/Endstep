import { sanitizeData } from '../data'
import type { AppData } from '../types'
import { GistClient, SyncError, type FetchFn } from './gist'
import { mergeSync, sameSyncData, syncable } from './merge'

// Cloud sync: on start, when the app comes back to the front, every minute while it's open
// and shortly after each change, this device and the cloud copy are merged (see merge.ts)
// and both end up with the result. The token stays on the device, outside the app data and
// outside backups.

const CONFIG_KEY = 'endstep:sync'
const SYNC_APP = 'endstep'

interface SyncConfig {
  token: string
  login: string
  gistId: string | null
  lastSync: string | null
}

export interface SyncState {
  status: 'off' | 'idle' | 'syncing' | 'error'
  login: string | null
  lastSync: string | null
  error: string | null
}

export function serializeSync(data: AppData): string {
  return JSON.stringify({ app: SYNC_APP, format: 1, updatedAt: new Date().toISOString(), data: syncable(data) })
}

export function parseSync(text: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new SyncError('The cloud copy is damaged. Your data on this device is fine.', 'other')
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { app?: unknown }).app !== SYNC_APP) {
    throw new SyncError('The cloud copy isn’t from Endstep.', 'other')
  }
  return sanitizeData((parsed as { data?: unknown }).data)
}

interface EngineDeps {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  getData: () => AppData
  apply: (merged: AppData) => void
  fetchFn?: FetchFn
  now?: () => string
}

export function createSyncEngine({ storage, getData, apply, fetchFn, now = () => new Date().toISOString() }: EngineDeps) {
  const listeners = new Set<() => void>()
  let running: Promise<void> | null = null
  let again = false

  const load = (): SyncConfig | null => {
    try {
      const raw = JSON.parse(storage.getItem(CONFIG_KEY) ?? 'null') as Partial<SyncConfig> | null
      return raw && typeof raw.token === 'string' && raw.token
        ? { token: raw.token, login: String(raw.login ?? ''), gistId: raw.gistId ?? null, lastSync: raw.lastSync ?? null }
        : null
    } catch {
      return null
    }
  }
  const save = (config: SyncConfig) => storage.setItem(CONFIG_KEY, JSON.stringify(config))

  const initial = load()
  let state: SyncState = {
    status: initial ? 'idle' : 'off',
    login: initial?.login ?? null,
    lastSync: initial?.lastSync ?? null,
    error: null,
  }
  const set = (patch: Partial<SyncState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }

  async function once(): Promise<void> {
    const config = load()
    if (!config) return
    set({ status: 'syncing' })
    try {
      const client = new GistClient(config.token, fetchFn)
      let gistId = config.gistId
      let text: string | null = null
      if (gistId) {
        try {
          text = await client.read(gistId)
        } catch (err) {
          // Deleted on github.com: look again, or start a new one.
          if (!(err instanceof SyncError && err.kind === 'missing')) throw err
          gistId = null
        }
      }
      if (!gistId) {
        gistId = await client.find()
        if (gistId) text = await client.read(gistId)
      }
      const remote = text ? parseSync(text) : null
      const merged = remote ? mergeSync(getData(), remote) : getData()
      if (!remote || !sameSyncData(merged, remote)) {
        const content = serializeSync(merged)
        if (gistId) await client.write(gistId, content)
        else gistId = await client.create(content)
      }
      apply(merged)
      // Disconnected meanwhile: don't bring the config back.
      if (load()?.token !== config.token) return
      const lastSync = now()
      save({ ...config, gistId, lastSync })
      set({ status: 'idle', lastSync, error: null })
    } catch (err) {
      if (load()?.token !== config.token) return
      set({ status: 'error', error: err instanceof Error ? err.message : 'Sync failed.' })
    }
  }

  /** Sync now. If a sync is running, one more follows it so the latest change goes up too. */
  function sync(): Promise<void> {
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      do {
        again = false
        await once()
      } while (again)
      running = null
    })()
    return running
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isConnected: () => load() !== null,
    sync,

    /** Check the token, then sync. Throws a SyncError with a message for the user. */
    async connect(token: string): Promise<void> {
      const clean = token.trim()
      if (!clean) throw new SyncError('Paste your token first.', 'auth')
      const login = await new GistClient(clean, fetchFn).login()
      save({ token: clean, login, gistId: null, lastSync: null })
      set({ status: 'idle', login, lastSync: null, error: null })
      await sync()
      if (state.status === 'error') throw new SyncError(state.error ?? 'Sync failed.', 'other')
    },

    /** Stop syncing on this device. The data here and in the cloud stays. */
    disconnect() {
      storage.removeItem(CONFIG_KEY)
      set({ status: 'off', login: null, lastSync: null, error: null })
    },
  }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.floor((now - Date.parse(iso)) / 60_000)
  if (!(min >= 1)) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'day' : 'days'} ago`
}
