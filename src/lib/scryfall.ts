import { useSyncExternalStore } from 'react'
import { cardKey, fromScryfall, type CardInfo, type ScryfallCard } from './cards'

// Card data comes live from the Scryfall API (https://scryfall.com/docs/api) and is
// stored locally. The bulk data (>100 MB) would be too big for a phone; we only need
// the ~100 cards of our own deck: two requests to /cards/collection.

const API = 'https://api.scryfall.com'
const CACHE_KEY = 'endstep:cards'
/** Scryfall allows at most 75 cards per collection request. */
const BATCH = 75
/** Scryfall asks for 50–100 ms between requests. */
const DELAY_MS = 100

type Fetch = typeof fetch
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const headers = { Accept: 'application/json' }

/** Which card (and optionally which printing) to load. */
export interface CardRequest {
  name: string
  set?: string | null
  number?: string
}

export interface FetchResult {
  /** Cards found, key = requested name (lower case). */
  found: Map<string, CardInfo>
  notFound: string[]
}

const toRequest = (r: CardRequest | string): CardRequest => (typeof r === 'string' ? { name: r } : r)

function identifier(r: CardRequest) {
  if (r.set && r.number) return { set: r.set, collector_number: r.number }
  if (r.set) return { name: r.name, set: r.set }
  return { name: r.name }
}

async function collection(requests: CardRequest[], fetchImpl: Fetch, delayMs: number, exact: boolean): Promise<Map<string, CardInfo>> {
  const byName = new Map<string, CardInfo>()
  for (let i = 0; i < requests.length; i += BATCH) {
    if (i > 0) await sleep(delayMs)
    const batch = requests.slice(i, i + BATCH)
    const res = await fetchImpl(`${API}/cards/collection`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: batch.map((r) => (exact ? identifier(r) : { name: r.name })) }),
    })
    if (!res.ok) throw new Error(`Scryfall responded with ${res.status}`)
    const body = (await res.json()) as { data: ScryfallCard[] }
    for (const raw of body.data) {
      const card = fromScryfall(raw)
      byName.set(cardKey(raw.name), card)
      for (const face of raw.card_faces ?? []) byName.set(cardKey(face.name), card)
    }
  }
  return byName
}

/**
 * Load cards: first exactly the requested printing (set/collector number), then for anything
 * not found the default version (marked with requestedSet), finally a fuzzy search.
 */
export async function fetchCards(
  requests: (CardRequest | string)[],
  fetchImpl: Fetch = fetch,
  delayMs = DELAY_MS,
): Promise<FetchResult> {
  const wanted = [...new Map(requests.map(toRequest).map((r) => [cardKey(r.name), { ...r, name: r.name.trim() }])).values()]
  const found = new Map<string, CardInfo>()

  const exact = await collection(wanted, fetchImpl, delayMs, true)
  for (const r of wanted) {
    const card = exact.get(cardKey(r.name))
    if (card) found.set(cardKey(r.name), card)
  }

  // Printing not found: take the default version and remember that it is not the requested one.
  const withoutPrinting = wanted.filter((r) => !found.has(cardKey(r.name)) && r.set)
  if (withoutPrinting.length > 0) {
    await sleep(delayMs)
    const any = await collection(withoutPrinting, fetchImpl, delayMs, false)
    for (const r of withoutPrinting) {
      const card = any.get(cardKey(r.name))
      if (card) found.set(cardKey(r.name), { ...card, requestedSet: r.set ?? undefined })
    }
  }

  const notFound: string[] = []
  for (const r of wanted) {
    if (found.has(cardKey(r.name))) continue
    await sleep(delayMs)
    const res = await fetchImpl(`${API}/cards/named?fuzzy=${encodeURIComponent(r.name)}`, { headers })
    if (res.ok) {
      const card = fromScryfall((await res.json()) as ScryfallCard)
      found.set(cardKey(r.name), r.set && card.set !== r.set ? { ...card, requestedSet: r.set } : card)
    } else notFound.push(r.name)
  }
  return { found, notFound }
}

/** Card name suggestions while typing (for swaps). */
export async function autocomplete(query: string, fetchImpl: Fetch = fetch): Promise<string[]> {
  if (query.trim().length < 2) return []
  const res = await fetchImpl(`${API}/cards/autocomplete?q=${encodeURIComponent(query.trim())}`, { headers })
  if (!res.ok) return []
  return ((await res.json()) as { data: string[] }).data
}

// --- Local storage ---------------------------------------------------------------

export type LoadStatus = 'idle' | 'loading' | 'error'

interface CardState {
  cards: Record<string, CardInfo>
  notFound: string[]
  status: LoadStatus
  error: string | null
}

function readCache(): Record<string, CardInfo> {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as { cards?: Record<string, CardInfo> }
    return raw.cards ?? {}
  } catch {
    return {}
  }
}

let state: CardState = { cards: readCache(), notFound: [], status: 'idle', error: null }
const listeners = new Set<() => void>()

function set(next: Partial<CardState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export function useCardState(): CardState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function getCard(name: string): CardInfo | undefined {
  return state.cards[cardKey(name)]
}

/** Does the stored card match the requested printing? */
export function satisfies(card: CardInfo | undefined, request: CardRequest): boolean {
  if (!card) return false
  if (!request.set) return true
  if (card.requestedSet === request.set) return true
  return card.set === request.set && (!request.number || card.collectorNumber === request.number)
}

export function missingCards(requests: (CardRequest | string)[]): CardRequest[] {
  const unique = [...new Map(requests.map(toRequest).map((r) => [cardKey(r.name), r])).values()]
  return unique.filter((r) => !satisfies(state.cards[cardKey(r.name)], r))
}

/**
 * Load missing cards (online only). Cards already stored are not requested again,
 * names unknown to Scryfall only with force (e.g. tapping "Try again").
 */
export async function ensureCards(
  requests: (CardRequest | string)[],
  { force = false, fetchImpl = fetch }: { force?: boolean; fetchImpl?: Fetch } = {},
): Promise<void> {
  const unknown = new Set(state.notFound.map(cardKey))
  const missing = missingCards(requests).filter((r) => force || !unknown.has(cardKey(r.name)))
  if (missing.length === 0 || state.status === 'loading') return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    set({ status: 'error', error: "Offline: card data will load as soon as you're back online." })
    return
  }
  set({ status: 'loading', error: null })
  try {
    const { found, notFound } = await fetchCards(missing, fetchImpl)
    const cards = { ...state.cards, ...Object.fromEntries(found) }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ cards }))
    } catch {
      // Storage full: data is kept for this session only.
    }
    const stillUnknown = [...new Set([...state.notFound.filter((n) => !found.has(cardKey(n))), ...notFound])]
    set({ cards, notFound: stillUnknown, status: 'idle' })
  } catch (err) {
    set({ status: 'error', error: err instanceof Error ? err.message : 'Scryfall is unreachable.' })
  }
}

/** Tests only: reset the store. */
export function resetCardState(cards: Record<string, CardInfo> = {}) {
  state = { cards, notFound: [], status: 'idle', error: null }
}
