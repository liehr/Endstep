// The cloud copy lives in a secret gist in the user's own GitHub account, so Endstep needs
// no server of its own. The GitHub API allows calls from any website (CORS).

const API = 'https://api.github.com'
/** The gist file Endstep looks for on every device. */
export const SYNC_FILE = 'endstep-sync.json'
const DESCRIPTION = 'Endstep cloud sync. Edited by the app, please leave as is.'

export type SyncErrorKind = 'auth' | 'scope' | 'network' | 'missing' | 'other'

export class SyncError extends Error {
  readonly kind: SyncErrorKind
  constructor(message: string, kind: SyncErrorKind) {
    super(message)
    this.kind = kind
  }
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

export class GistClient {
  private readonly token: string
  private readonly fetchFn: FetchFn
  constructor(token: string, fetchFn: FetchFn = (url, init) => fetch(url, init)) {
    this.token = token
    this.fetchFn = fetchFn
  }

  private async call<T>(url: string, init: RequestInit = {}): Promise<T> {
    let res: Response
    try {
      res = await this.fetchFn(url.startsWith('http') ? url : API + url, {
        ...init,
        // GitHub sends "max-age=60": without this a device could read a minute-old copy.
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      })
    } catch {
      throw new SyncError('No connection to GitHub. Sync continues when you’re back online.', 'network')
    }
    if (res.status === 401) throw new SyncError('GitHub didn’t accept the token. It may have expired: create a new one.', 'auth')
    if (res.status === 403) throw new SyncError('The token isn’t allowed to use gists. Create one with the “gist” scope.', 'scope')
    if (res.status === 404) throw new SyncError('The sync gist is gone.', 'missing')
    if (!res.ok) throw new SyncError(`GitHub had a problem (${res.status}). Sync tries again later.`, 'other')
    return (await res.json()) as T
  }

  /** The GitHub login the token belongs to. */
  async login(): Promise<string> {
    return (await this.call<{ login: string }>('/user')).login
  }

  /** ID of the Endstep sync gist, if this account has one. */
  async find(): Promise<string | null> {
    for (let page = 1; page <= 10; page++) {
      const gists = await this.call<{ id: string; files: Record<string, unknown> }[]>(`/gists?per_page=100&page=${page}`)
      const hit = gists.find((g) => SYNC_FILE in g.files)
      if (hit) return hit.id
      if (gists.length < 100) break
    }
    return null
  }

  async create(content: string): Promise<string> {
    const gist = await this.call<{ id: string }>('/gists', {
      method: 'POST',
      body: JSON.stringify({ description: DESCRIPTION, public: false, files: { [SYNC_FILE]: { content } } }),
    })
    return gist.id
  }

  /** The sync file's text, or null if the gist has no such file. */
  async read(id: string): Promise<string | null> {
    const gist = await this.call<{ files: Record<string, { content?: string; truncated?: boolean; raw_url?: string } | null> }>(`/gists/${id}`)
    const file = gist.files[SYNC_FILE]
    if (!file) return null
    // Files over 1 MB come without content; the raw URL has the full text.
    if (file.truncated && file.raw_url) {
      try {
        const res = await this.fetchFn(file.raw_url, { cache: 'no-store' })
        if (res.ok) return await res.text()
      } catch {
        // Falls through to the error below.
      }
      throw new SyncError('Couldn’t download the cloud copy. Sync tries again later.', 'network')
    }
    return file.content ?? null
  }

  async write(id: string, content: string): Promise<void> {
    await this.call(`/gists/${id}`, { method: 'PATCH', body: JSON.stringify({ files: { [SYNC_FILE]: { content } } }) })
  }
}
