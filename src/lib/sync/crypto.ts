import { normalizeCode } from './code'

// Everything is encrypted on the device before it leaves. The sync code is both the address
// and the key: the server only ever sees an unreadable blob under a meaningless ID, so not
// even whoever runs the server can read anyone's data.

const SALT = new TextEncoder().encode('endstep-sync-v1')
/** Slow on purpose, so guessing codes takes years instead of minutes. */
const ITERATIONS = 310_000
const PREFIX = 'e1.'

export interface SyncKeys {
  /** Where the cloud copy lives (hex, reveals nothing about the code). */
  id: string
  key: CryptoKey
}

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function deriveKeys(code: string): Promise<SyncKeys> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalizeCode(code)), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' }, material, 512))
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt'])
  const id = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bits.slice(32))))
  return { id, key }
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

/** Compress and encrypt: "e1." + base64(iv + ciphertext). */
export async function seal(text: string, key: CryptoKey): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(text), new CompressionStream('gzip'))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed as BufferSource))
  const out = new Uint8Array(iv.length + cipher.length)
  out.set(iv)
  out.set(cipher, iv.length)
  return PREFIX + toBase64(out)
}

/** Throws if the blob wasn't sealed with this key. */
export async function open(blob: string, key: CryptoKey): Promise<string> {
  if (!blob.startsWith(PREFIX)) throw new Error('Unknown format')
  const bytes = fromBase64(blob.slice(PREFIX.length))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12))
  return new TextDecoder().decode(await pipe(new Uint8Array(plain), new DecompressionStream('gzip')))
}
