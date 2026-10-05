import { sanitizeData } from '../data'
import type { AppData } from '../types'
import { SyncError, type SyncBackend } from './backend'
import { formatCode, generateCode, isValidCode, normalizeCode } from './code'
import { deriveKeys, open, seal, type SyncKeys } from './crypto'
import { mergeSync, sameSyncData, syncable } from './merge'

// Cloud sync: on start, when the app comes back to the front, regularly while it's open and
// shortly after each change, this device and the cloud copy are merged (see merge.ts) and
// both end up with the result. The sync code stays on the device, outside the app data and
// outside backups.

const CONFIG_KEY = 'endstep:sync'
const SYNC_APP = 'endstep'
/** Another device wrote in between: merge again, but don't loop forever. */
const MAX_ROUNDS = 4

interface SyncConfig {
  code: string
  lastSync: string | null
}

export interface SyncState {
  status: 'off' | 'idle' | 'syncing' | 'error'
  /** Formatted sync code (K7QM-4XTD-P9). */
  code: string | null
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
  backend: SyncBackend
  now?: () => string
}

export function createSyncEngine({ storage, getData, apply, backend, now = () => new Date().toISOString() }: EngineDeps) {
  const listeners = new Set<() => void>()
  let running: Promise<void> | null = null
  let again = false
  let keys: { code: string; keys: Promise<SyncKeys> } | null = null

  const load = (): SyncConfig | null => {
    try {
      const raw = JSON.parse(storage.getItem(CONFIG_KEY) ?? 'null') as Partial<SyncConfig> | null
      return raw && typeof raw.code === 'string' && isValidCode(raw.code) ? { code: normalizeCode(raw.code), lastSync: raw.lastSync ?? null } : null
    } catch {
      return null
    }
  }
  const save = (config: SyncConfig) => storage.setItem(CONFIG_KEY, JSON.stringify(config))
  const keysFor = (code: string) => {
    if (keys?.code !== code) keys = { code, keys: deriveKeys(code) }
    return keys.keys
  }

  const initial = load()
  let state: SyncState = {
    status: initial ? 'idle' : 'off',
    code: initial ? formatCode(initial.code) : null,
    lastSync: initial?.lastSync ?? null,
    error: null,
  }
  const set = (patch: Partial<SyncState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }

  async function decrypt(blob: string, key: CryptoKey): Promise<AppData> {
    let text: string
    try {
      text = await open(blob, key)
    } catch {
      throw new SyncError('The cloud copy can’t be read with this code.', 'code')
    }
    return parseSync(text)
  }

  async function once(): Promise<void> {
    const config = load()
    if (!config) return
    set({ status: 'syncing' })
    try {
      const { id, key } = await keysFor(config.code)
      for (let round = 1; ; round++) {
        const stored = await backend.read(id)
        const remote = stored ? await decrypt(stored.blob, key) : null
        const merged = remote ? mergeSync(getData(), remote) : getData()
        if (remote && sameSyncData(merged, remote)) {
          apply(merged)
          break
        }
        const result = await backend.write(id, await seal(serializeSync(merged), key), stored?.version ?? null)
        if (result === 'ok') {
          apply(merged)
          break
        }
        if (round >= MAX_ROUNDS) throw new SyncError('Other devices are busy syncing. Trying again shortly.', 'other')
      }
      // Turned off meanwhile: don't bring the config back.
      if (load()?.code !== config.code) return
      const lastSync = now()
      save({ ...config, lastSync })
      set({ status: 'idle', lastSync, error: null })
    } catch (err) {
      if (load()?.code !== config.code) return
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

  async function start(code: string): Promise<void> {
    save({ code, lastSync: null })
    set({ status: 'idle', code: formatCode(code), lastSync: null, error: null })
    await sync()
    if (state.status === 'error') throw new SyncError(state.error ?? 'Sync failed.', 'other')
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isConnected: () => load() !== null,
    sync,

    /** First device: make a new code and upload this device's data. */
    create: () => start(generateCode()),

    /** Another device: join with a code. Throws a SyncError with a message for the user. */
    async join(input: string): Promise<void> {
      if (!isValidCode(input)) throw new SyncError('That code isn’t right. Check it on your other device.', 'code')
      const code = normalizeCode(input)
      const { id, key } = await keysFor(code)
      const stored = await backend.read(id)
      if (!stored) throw new SyncError('Nothing is synced under this code yet. Check it on your other device.', 'code')
      await decrypt(stored.blob, key)
      await start(code)
    },

    /** Stop syncing on this device. The data here and in the cloud stays. */
    disconnect() {
      storage.removeItem(CONFIG_KEY)
      set({ status: 'off', code: null, lastSync: null, error: null })
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
