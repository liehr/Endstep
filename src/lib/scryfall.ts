import { useSyncExternalStore } from 'react'
import { cardKey, fromScryfall, type CardInfo, type ScryfallCard } from './cards'

// Kartendaten kommen live von der Scryfall-API (https://scryfall.com/docs/api) und werden
// lokal gespeichert. Die Bulk-Daten (>100 MB) wären fürs Handy zu groß; wir brauchen nur
// die ~100 Karten des eigenen Decks: zwei Anfragen an /cards/collection.

const API = 'https://api.scryfall.com'
const CACHE_KEY = 'endstep:cards'
/** Scryfall erlaubt höchstens 75 Karten pro Collection-Anfrage. */
const BATCH = 75
/** Scryfall bittet um 50–100 ms Abstand zwischen Anfragen. */
const DELAY_MS = 100

type Fetch = typeof fetch
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const headers = { Accept: 'application/json' }

/** Welche Karte (und optional welche Druckversion) geladen werden soll. */
export interface CardRequest {
  name: string
  set?: string | null
  number?: string
}

export interface FetchResult {
  /** Gefundene Karten, Schlüssel = angefragter Name (klein geschrieben). */
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
    if (!res.ok) throw new Error(`Scryfall antwortet mit ${res.status}`)
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
 * Karten laden: zuerst genau die gewünschte Druckversion (Set/Sammlernummer), dann für
 * nicht Gefundenes die Standardversion (markiert mit requestedSet), zuletzt unscharfe Suche.
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

  // Druckversion nicht gefunden: Standardversion nehmen und merken, dass es nicht die gewünschte ist.
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

/** Kartennamen-Vorschläge beim Tippen (für Swaps). */
export async function autocomplete(query: string, fetchImpl: Fetch = fetch): Promise<string[]> {
  if (query.trim().length < 2) return []
  const res = await fetchImpl(`${API}/cards/autocomplete?q=${encodeURIComponent(query.trim())}`, { headers })
  if (!res.ok) return []
  return ((await res.json()) as { data: string[] }).data
}

// --- Lokaler Speicher ----------------------------------------------------------

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

/** Passt die gespeicherte Karte zur gewünschten Druckversion? */
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
 * Fehlende Karten nachladen (nur online). Bereits gespeicherte werden nicht erneut angefragt,
 * bei Scryfall unbekannte Namen nur mit force (z. B. Tipp auf „Erneut versuchen“).
 */
export async function ensureCards(
  requests: (CardRequest | string)[],
  { force = false, fetchImpl = fetch }: { force?: boolean; fetchImpl?: Fetch } = {},
): Promise<void> {
  const unknown = new Set(state.notFound.map(cardKey))
  const missing = missingCards(requests).filter((r) => force || !unknown.has(cardKey(r.name)))
  if (missing.length === 0 || state.status === 'loading') return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    set({ status: 'error', error: 'Offline: Kartendaten werden geladen, sobald du wieder online bist.' })
    return
  }
  set({ status: 'loading', error: null })
  try {
    const { found, notFound } = await fetchCards(missing, fetchImpl)
    const cards = { ...state.cards, ...Object.fromEntries(found) }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ cards }))
    } catch {
      // Speicher voll: Daten bleiben nur für diese Sitzung.
    }
    const stillUnknown = [...new Set([...state.notFound.filter((n) => !found.has(cardKey(n))), ...notFound])]
    set({ cards, notFound: stillUnknown, status: 'idle' })
  } catch (err) {
    set({ status: 'error', error: err instanceof Error ? err.message : 'Scryfall nicht erreichbar.' })
  }
}

/** Nur für Tests: Speicher zurücksetzen. */
export function resetCardState(cards: Record<string, CardInfo> = {}) {
  state = { cards, notFound: [], status: 'idle', error: null }
}
