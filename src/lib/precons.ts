import { cardKey } from './cards'
import index from './precons.json'
import type { DeckEntry } from './types'

// Commander precons come from MTGJSON (https://mtgjson.com), which allows requests from
// the browser. The index of all precons is bundled (scripts/precons.mjs regenerates it),
// so the search also works offline; the decklist itself is loaded when you pick a deck.

const API = 'https://mtgjson.com/api/v5'

export interface Precon {
  /** MTGJSON file name, e.g. "TramplesaurusRex_FDC". */
  file: string
  name: string
  /** Set code (lower case). */
  set: string
  /** Release date (YYYY-MM-DD). */
  released: string
  commanders: string[]
}

export const PRECONS: Precon[] = index

export const PRECON_BY_FILE = new Map(PRECONS.map((p) => [p.file, p]))

/** Lower case, without accents and punctuation, so "Veloci-Ramp-Tor" matches "velociramp". */
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')

/**
 * Search by deck name, commander, set code or year. Every word has to match somewhere.
 * Decks whose name or commander starts with the query come first, otherwise newest first.
 */
export function searchPrecons(query: string, list: Precon[] = PRECONS, limit = 30): Precon[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return list.slice(0, limit)
  const whole = words.join(' ')
  const scored = list
    .map((p) => {
      const names = [p.name, ...p.commanders].map(normalize)
      const haystack = [...names, p.set, p.released.slice(0, 4)].join(' ')
      const squashed = haystack.replace(/ /g, '')
      if (!words.every((w) => haystack.includes(w) || squashed.includes(w))) return null
      return { p, prefix: names.some((n) => n.startsWith(whole)) ? 0 : 1 }
    })
    .filter((x) => x !== null)
  return scored
    .sort((a, b) => a.prefix - b.prefix)
    .slice(0, limit)
    .map((x) => x.p)
}

export interface PreconDeck {
  commander: string
  commanderSet: string | null
  entries: DeckEntry[]
}

interface MtgjsonCard {
  name?: unknown
  count?: unknown
  setCode?: unknown
  number?: unknown
  side?: unknown
}

const SET_RE = /^[a-z0-9]{2,6}$/

/** Art-series style names ("Okaun // Okaun") become one name. */
const sameFaces = (name: string) => {
  const [front, back] = name.split(' // ')
  return back === front ? front : name
}

function toEntry(card: MtgjsonCard): DeckEntry | null {
  if (typeof card.name !== 'string' || card.side === 'b') return null
  const qty = typeof card.count === 'number' && card.count > 0 ? card.count : 1
  const set = typeof card.setCode === 'string' ? card.setCode.toLowerCase() : ''
  const number = typeof card.number === 'string' && card.number.length <= 10 ? card.number : ''
  return {
    name: sameFaces(card.name),
    qty,
    ...(SET_RE.test(set) ? { set } : {}),
    ...(SET_RE.test(set) && number ? { number } : {}),
  }
}

/**
 * Reads an MTGJSON deck file. Partner precons have two commanders: the first one becomes
 * the commander, the second goes into the 99 for now.
 */
export function parsePreconDeck(raw: unknown): PreconDeck {
  const data = (raw as { data?: { commander?: unknown; mainBoard?: unknown } } | null)?.data
  const commanders = (Array.isArray(data?.commander) ? data.commander : []).map(toEntry).filter((e) => e !== null)
  const main = (Array.isArray(data?.mainBoard) ? data.mainBoard : []).map(toEntry).filter((e) => e !== null)
  const [commander, ...partners] = commanders
  if (!commander) throw new Error('This precon has no commander.')

  const entries = new Map<string, DeckEntry>()
  for (const e of [...partners, ...main]) {
    const existing = entries.get(cardKey(e.name))
    if (existing) existing.qty += e.qty
    else entries.set(cardKey(e.name), { ...e })
  }
  return { commander: commander.name, commanderSet: commander.set ?? null, entries: [...entries.values()] }
}

/** Load the decklist of a precon from MTGJSON. */
export async function fetchPreconDeck(file: string, fetchImpl: typeof fetch = fetch): Promise<PreconDeck> {
  if (!/^[A-Za-z0-9_]+$/.test(file)) throw new Error('Unknown precon.')
  let res: Response
  try {
    res = await fetchImpl(`${API}/decks/${file}.json`, { headers: { Accept: 'application/json' } })
  } catch {
    throw new Error('No connection. Loading a precon needs internet once.')
  }
  if (!res.ok) throw new Error(`MTGJSON responded with ${res.status}`)
  return parsePreconDeck(await res.json())
}
