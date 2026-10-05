import { SyncError, type FetchFn, type Stored, type SyncBackend } from './backend'

// Cloud Firestore through its REST API (no SDK needed). Each sync space is one document
// sync/<id> with a single field "blob". The security rules (docs/cloud-sync.md) only allow
// reading and writing a document whose ID you know, never listing them.

export interface FirestoreConfig {
  projectId: string
  apiKey: string
}

export function firestoreBackend(config: FirestoreConfig, fetchFn: FetchFn = (url, init) => fetch(url, init)): SyncBackend {
  const base = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/sync`

  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetchFn(url, { ...init, cache: 'no-store', headers: init.body ? { 'Content-Type': 'application/json' } : {} })
    } catch {
      throw new SyncError('No connection. Sync continues when you’re back online.', 'network')
    }
  }

  const fail = (res: Response): never => {
    if (res.status === 403) throw new SyncError('The sync server refused access. Its setup may be incomplete.', 'setup')
    throw new SyncError(`The sync server had a problem (${res.status}). Sync tries again later.`, 'other')
  }

  return {
    async read(id) {
      const res = await call(`${base}/${id}?key=${config.apiKey}`)
      if (res.status === 404) return null
      if (!res.ok) fail(res)
      const doc = (await res.json()) as { fields?: { blob?: { stringValue?: string } }; updateTime: string }
      const blob = doc.fields?.blob?.stringValue
      return blob ? ({ blob, version: doc.updateTime } satisfies Stored) : null
    },

    async write(id, blob, version) {
      const precondition = version === null ? 'currentDocument.exists=false' : `currentDocument.updateTime=${encodeURIComponent(version)}`
      const res = await call(`${base}/${id}?key=${config.apiKey}&${precondition}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: { blob: { stringValue: blob } } }),
      })
      // Another device wrote first (FAILED_PRECONDITION / ALREADY_EXISTS).
      if (res.status === 400 || res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: { status?: string } }
        if (body.error?.status === 'FAILED_PRECONDITION' || body.error?.status === 'ALREADY_EXISTS') return 'conflict'
      }
      if (!res.ok) fail(res)
      return 'ok'
    },
  }
}
