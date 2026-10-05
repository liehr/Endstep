import { describe, expect, it } from 'vitest'
import { emptyData } from '../data'
import { makeGame } from '../test-utils'
import type { AppData } from '../types'
import { createSyncEngine, parseSync, timeAgo } from './engine'
import { SYNC_FILE, type FetchFn } from './gist'
import { mergeSync, sameSyncData, trackChanges } from './merge'

/** A tiny stand-in for the GitHub gist API. */
function fakeGitHub(token = 'good') {
  const gists = new Map<string, Record<string, { content: string }>>()
  let next = 1
  let online = true
  const calls: string[] = []
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
  const fetchFn: FetchFn = async (url, init = {}) => {
    if (!online) throw new TypeError('Failed to fetch')
    const method = init.method ?? 'GET'
    const path = url.replace('https://api.github.com', '')
    calls.push(`${method} ${path}`)
    if ((init.headers as Record<string, string>).Authorization !== `Bearer ${token}`) return json({}, 401)
    if (path === '/user') return json({ login: 'flo' })
    if (path.startsWith('/gists?')) return json([...gists].map(([id, files]) => ({ id, files })))
    if (path === '/gists' && method === 'POST') {
      const id = `g${next++}`
      gists.set(id, JSON.parse(String(init.body)).files)
      return json({ id }, 201)
    }
    const id = path.replace('/gists/', '')
    const gist = gists.get(id)
    if (!gist) return json({}, 404)
    if (method === 'PATCH') Object.assign(gist, JSON.parse(String(init.body)).files)
    return json({ id, files: gist })
  }
  return { fetchFn, gists, calls, setOnline: (v: boolean) => (online = v) }
}

function device(github: ReturnType<typeof fakeGitHub>, start: AppData) {
  const store = new Map<string, string>()
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  const dev = {
    data: start,
    change(next: AppData) {
      dev.data = trackChanges(dev.data, next)
    },
    engine: createSyncEngine({
      storage,
      getData: (): AppData => dev.data,
      apply: (merged: AppData): void => {
        dev.data = mergeSync(dev.data, merged)
      },
      fetchFn: github.fetchFn,
    }),
  }
  return dev
}

const chosen = (): AppData => ({ ...emptyData(), deckChosen: true })

describe('cloud sync engine', () => {
  it('first device creates the gist, second device finds it and both end up equal', async () => {
    const github = fakeGitHub()
    const phone = device(github, { ...chosen(), games: [makeGame({ id: 'phone' })] })
    await phone.engine.connect('good')
    expect(github.gists.size).toBe(1)
    expect(phone.engine.getState()).toMatchObject({ status: 'idle', login: 'flo' })

    const pc = device(github, emptyData())
    await pc.engine.connect('good')
    expect(github.gists.size).toBe(1)
    expect(pc.data.deckChosen).toBe(true)
    expect(pc.data.games.map((g) => g.id)).toEqual(['phone'])

    pc.change({ ...pc.data, games: [...pc.data.games, makeGame({ id: 'pc' })] })
    await pc.engine.sync()
    await phone.engine.sync()
    expect(phone.data.games.map((g) => g.id).sort()).toEqual(['pc', 'phone'])
    expect(sameSyncData(phone.data, pc.data)).toBe(true)
  })

  it('doesn’t upload when nothing changed', async () => {
    const github = fakeGitHub()
    const phone = device(github, chosen())
    await phone.engine.connect('good')
    github.calls.length = 0
    await phone.engine.sync()
    expect(github.calls.filter((c) => c.startsWith('PATCH'))).toEqual([])
  })

  it('changes made offline go up once the device is back online', async () => {
    const github = fakeGitHub()
    const phone = device(github, chosen())
    await phone.engine.connect('good')
    github.setOnline(false)
    phone.change({ ...phone.data, games: [makeGame({ id: 'offline' })] })
    await phone.engine.sync()
    expect(phone.engine.getState().status).toBe('error')
    github.setOnline(true)
    await phone.engine.sync()
    const [gist] = github.gists.values()
    expect(parseSync(gist[SYNC_FILE].content).games.map((g) => g.id)).toEqual(['offline'])
  })

  it('rejects a bad token without saving it', async () => {
    const phone = device(fakeGitHub(), chosen())
    await expect(phone.engine.connect('bad')).rejects.toThrow(/token/)
    expect(phone.engine.isConnected()).toBe(false)
  })

  it('starts a new gist if the old one was deleted', async () => {
    const github = fakeGitHub()
    const phone = device(github, { ...chosen(), games: [makeGame({ id: 'kept' })] })
    await phone.engine.connect('good')
    github.gists.clear()
    await phone.engine.sync()
    expect(github.gists.size).toBe(1)
    const [gist] = github.gists.values()
    expect(parseSync(gist[SYNC_FILE].content).games.map((g) => g.id)).toEqual(['kept'])
  })

  it('disconnecting keeps the data on the device', async () => {
    const github = fakeGitHub()
    const phone = device(github, { ...chosen(), games: [makeGame()] })
    await phone.engine.connect('good')
    phone.engine.disconnect()
    expect(phone.engine.getState().status).toBe('off')
    expect(phone.data.games).toHaveLength(1)
    github.calls.length = 0
    await phone.engine.sync()
    expect(github.calls).toEqual([])
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
