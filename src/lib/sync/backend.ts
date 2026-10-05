// Where the encrypted cloud copy is kept. The engine only needs these two calls, so the
// storage service can be swapped without touching the sync logic.

export type SyncErrorKind = 'network' | 'code' | 'setup' | 'other'

export class SyncError extends Error {
  readonly kind: SyncErrorKind
  constructor(message: string, kind: SyncErrorKind) {
    super(message)
    this.kind = kind
  }
}

export interface Stored {
  blob: string
  /** Changes with every write; a write only succeeds against the version it read. */
  version: string
}

export interface SyncBackend {
  read(id: string): Promise<Stored | null>
  /** `version` null = create; returns 'conflict' if another device wrote in between. */
  write(id: string, blob: string, version: string | null): Promise<'ok' | 'conflict'>
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>
