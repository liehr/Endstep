import { describe, expect, it } from 'vitest'
import type { FetchFn } from './backend'
import { firestoreBackend } from './firestore'

const config = { projectId: 'endstep-test', apiKey: 'KEY' }
const ID = 'a'.repeat(64)

function fake(respond: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchFn: FetchFn = async (url, init = {}) => {
    calls.push({ url, init })
    return respond(url, init)
  }
  return { fetchFn, calls }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('firestore backend', () => {
  it('reads the blob and its version', async () => {
    const { fetchFn, calls } = fake(() => json({ fields: { blob: { stringValue: 'e1.xyz' } }, updateTime: '2026-10-05T10:00:00.123456Z' }))
    expect(await firestoreBackend(config, fetchFn).read(ID)).toEqual({ blob: 'e1.xyz', version: '2026-10-05T10:00:00.123456Z' })
    expect(calls[0].url).toBe(`https://firestore.googleapis.com/v1/projects/endstep-test/databases/(default)/documents/sync/${ID}?key=KEY`)
  })

  it('a missing document reads as nothing', async () => {
    const { fetchFn } = fake(() => json({ error: { status: 'NOT_FOUND' } }, 404))
    expect(await firestoreBackend(config, fetchFn).read(ID)).toBeNull()
  })

  it('writes only against the version it read', async () => {
    const { fetchFn, calls } = fake(() => json({}))
    const backend = firestoreBackend(config, fetchFn)
    expect(await backend.write(ID, 'e1.new', null)).toBe('ok')
    expect(await backend.write(ID, 'e1.new', '2026-10-05T10:00:00Z')).toBe('ok')
    expect(calls[0].url).toContain('currentDocument.exists=false')
    expect(calls[1].url).toContain('currentDocument.updateTime=2026-10-05T10%3A00%3A00Z')
    expect(calls[1].init.method).toBe('PATCH')
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ fields: { blob: { stringValue: 'e1.new' } } })
  })

  it('reports a conflict when another device wrote first', async () => {
    const { fetchFn } = fake(() => json({ error: { status: 'FAILED_PRECONDITION' } }, 400))
    expect(await firestoreBackend(config, fetchFn).write(ID, 'e1.x', 'old')).toBe('conflict')
  })

  it('turns failures into messages', async () => {
    const offline = firestoreBackend(config, async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(offline.read(ID)).rejects.toThrow(/No connection/)
    const denied = firestoreBackend(config, fake(() => json({}, 403)).fetchFn)
    await expect(denied.read(ID)).rejects.toThrow(/refused/)
  })
})
