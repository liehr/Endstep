import { describe, expect, it } from 'vitest'
import { emptyData } from '../data'
import { makeGame } from '../test-utils'
import type { AppData } from '../types'
import { SyncError, type Stored, type SyncBackend } from './backend'
import { deriveKeys, open } from './crypto'
import { createSyncEngine, parseSync, timeAgo } from './engine'
import { mergeSync, sameSyncData, trackChanges } from './merge'

/** An in-memory sync server with versions, like Firestore's update times. */
function fakeServer() {
  const docs = new Map<string, Stored>()
  let version = 0
  let online = true
  let writes = 0
  /** Runs right before the next write lands, to simulate another device racing us. */
  let beforeWrite: (() => Promise<void>) | null = null
  const backend: SyncBackend = {
    async read(id) {
      if (!online) throw new SyncError('offline', 'network')
      return docs.get(id) ?? null
    },
    async write(id, blob, expected) {
      if (!online) throw new SyncError('offline', 'network')
      const hook = beforeWrite
      beforeWrite = null
      await hook?.()
      if ((docs.get(id)?.version ?? null) !== expected) return 'conflict'
      writes++
      docs.set(id, { blob, version: `v${++version}` })
      return 'ok'
    },
  }
  return {
    backend,
    docs,
    writes: () => writes,
    setOnline: (v: boolean) => (online = v),
    race: (fn: () => Promise<void>) => (beforeWrite = fn),
  }
}

type Server = ReturnType<typeof fakeServer>

function device(server: Server, start: AppData) {
  const store = new Map<string, string>()
  const dev = {
    data: start,
    change(next: AppData) {
      dev.data = trackChanges(dev.data, next)
    },
    engine: createSyncEngine({
      storage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, v),
        removeItem: (k) => void store.delete(k),
      },
      getData: (): AppData => dev.data,
      apply: (merged: AppData): void => {
        dev.data = mergeSync(dev.data, merged)
      },
      backend: server.backend,
    }),
  }
  return dev
}

const chosen = (): AppData => ({ ...emptyData(), deckChosen: true })

async function cloudCopy(server: Server, code: string) {
  const { id, key } = await deriveKeys(code)
  return parseSync(await open(server.docs.get(id)!.blob, key))
}

describe('cloud sync engine', () => {
  it('first device makes a code, second device joins with it and both end up equal', async () => {
    const server = fakeServer()
    const phone = device(server, { ...chosen(), games: [makeGame({ id: 'phone' })] })
    await phone.engine.create()
    const code = phone.engine.getState().code!
    expect(code).toMatch(/^\w{4}-\w{4}-\w{2}$/)
    expect(server.docs.size).toBe(1)

    const pc = device(server, emptyData())
    await pc.engine.join(code.toLowerCase())
    expect(pc.data.deckChosen).toBe(true)
    expect(pc.data.games.map((g) => g.id)).toEqual(['phone'])

    pc.change({ ...pc.data, games: [...pc.data.games, makeGame({ id: 'pc' })] })
    await pc.engine.sync()
    await phone.engine.sync()
    expect(phone.data.games.map((g) => g.id).sort()).toEqual(['pc', 'phone'])
    expect(sameSyncData(phone.data, pc.data)).toBe(true)
  })

  it('the server only ever sees encrypted data', async () => {
    const server = fakeServer()
    const phone = device(server, { ...chosen(), games: [makeGame({ winner: 'Atraxa' })] })
    await phone.engine.create()
    const [stored] = server.docs.values()
    expect(stored.blob).not.toContain('Atraxa')
    expect((await cloudCopy(server, phone.engine.getState().code!)).games[0].winner).toBe('Atraxa')
  })

  it('doesn’t upload when nothing changed', async () => {
    const server = fakeServer()
    const phone = device(server, chosen())
    await phone.engine.create()
    const before = server.writes()
    await phone.engine.sync()
    expect(server.writes()).toBe(before)
  })

  it('when another device writes in between, merges again instead of overwriting it', async () => {
    const server = fakeServer()
    const phone = device(server, chosen())
    await phone.engine.create()
    const code = phone.engine.getState().code!
    const pc = device(server, emptyData())
    await pc.engine.join(code)

    pc.change({ ...pc.data, games: [makeGame({ id: 'pc' })] })
    phone.change({ ...phone.data, games: [makeGame({ id: 'phone' })] })
    // The PC's upload lands while the phone is about to write.
    server.race(() => pc.engine.sync())
    await phone.engine.sync()
    expect((await cloudCopy(server, code)).games.map((g) => g.id).sort()).toEqual(['pc', 'phone'])
    await pc.engine.sync()
    expect(pc.data.games.map((g) => g.id).sort()).toEqual(['pc', 'phone'])
  })

  it('changes made offline go up once the device is back online', async () => {
    const server = fakeServer()
    const phone = device(server, chosen())
    await phone.engine.create()
    server.setOnline(false)
    phone.change({ ...phone.data, games: [makeGame({ id: 'offline' })] })
    await phone.engine.sync()
    expect(phone.engine.getState().status).toBe('error')
    server.setOnline(true)
    await phone.engine.sync()
    expect((await cloudCopy(server, phone.engine.getState().code!)).games.map((g) => g.id)).toEqual(['offline'])
  })

  it('rejects a mistyped or unknown code without turning sync on', async () => {
    const pc = device(fakeServer(), emptyData())
    await expect(pc.engine.join('ABCD-EFGH-JK')).rejects.toThrow(/isn’t right/)
    const phone = device(fakeServer(), chosen())
    await phone.engine.create()
    await expect(pc.engine.join(phone.engine.getState().code!)).rejects.toThrow(/Nothing is synced/)
    expect(pc.engine.isConnected()).toBe(false)
  })

  it('turning off keeps the data on the device and stops syncing', async () => {
    const server = fakeServer()
    const phone = device(server, { ...chosen(), games: [makeGame()] })
    await phone.engine.create()
    phone.engine.disconnect()
    expect(phone.engine.getState()).toMatchObject({ status: 'off', code: null })
    expect(phone.data.games).toHaveLength(1)
    const before = server.writes()
    phone.change({ ...phone.data, games: [] })
    await phone.engine.sync()
    expect(server.writes()).toBe(before)
  })
})

describe('timeAgo', () => {
  const now = Date.parse('2026-10-05T12:00:00Z')
  it('reads like a person would say it', () => {
    expect(timeAgo('2026-10-05T11:59:30Z', now)).toBe('just now')
    expect(timeAgo('2026-10-05T11:55:00Z', now)).toBe('5 min ago')
    expect(timeAgo('2026-10-05T09:00:00Z', now)).toBe('3 h ago')
    expect(timeAgo('2026-10-04T12:00:00Z', now)).toBe('1 day ago')
  })
})
