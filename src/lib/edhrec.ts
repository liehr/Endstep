import { cardKey } from './cards'

// Swap suggestions from EDHREC (https://edhrec.com): which cards other players run with
// your commander. EDHREC's commander pages are public JSON and allow requests from the
// browser. We only read names and how many decks play them; card data stays with Scryfall.

const API = 'https://json.edhrec.com/pages/commanders'
const CACHE_KEY = 'endstep:edhrec'

export interface Suggestion {
  name: string
  /** Share of this commander's decks on EDHREC that play the card (0–1). */
  inclusion: number
  /** How much more often it's played with this commander than in other decks of its colors. */
  synergy: number
  /** EDHREC's list, e.g. "Creatures" or "Instants". */
  group: string
}

/** "Niv-Mizzet, Parun" → "niv-mizzet-parun"; for double-faced cards the front face counts. */
export function commanderSlug(commander: string): string {
  return commander
    .split(' // ')[0]
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
}

interface CardView {
  name?: unknown
  synergy?: unknown
  num_decks?: unknown
  potential_decks?: unknown
}

interface CardList {
  header?: unknown
  tag?: unknown
  cardviews?: unknown
}

/** Lists that aren't a kind of card ("New Cards", "Top Cards" …): only used to fill gaps. */
const MIXED_LISTS = new Set(['newcards', 'highsynergycards', 'highliftcards', 'topcards'])

/**
 * Read EDHREC's commander page: every card once, without Game Changers when asked
 * (they lift a deck above Bracket 2), without basic lands and without cards already in the deck.
 */
export function parseSuggestions(
  raw: unknown,
  { inDeck = [], gameChangers = false }: { inDeck?: string[]; gameChangers?: boolean } = {},
): Suggestion[] {
  const lists = (raw as { container?: { json_dict?: { cardlists?: unknown } } } | null)?.container?.json_dict?.cardlists
  if (!Array.isArray(lists)) throw new Error('EDHREC has no card lists for this commander.')
  const skip = new Set(inDeck.map(cardKey))
  const banned = new Set<string>()
  if (!gameChangers) {
    for (const list of lists as CardList[]) {
      if (list.tag !== 'gamechangers' || !Array.isArray(list.cardviews)) continue
      for (const v of list.cardviews as CardView[]) if (typeof v.name === 'string') banned.add(cardKey(v.name))
    }
  }

  const out = new Map<string, Suggestion>()
  // Kind lists first, so a card's group is "Creatures" rather than "Top Cards".
  const ordered = [...(lists as CardList[])].sort((a, b) => Number(MIXED_LISTS.has(String(a.tag))) - Number(MIXED_LISTS.has(String(b.tag))))
  for (const list of ordered) {
    if (list.tag === 'gamechangers' || !Array.isArray(list.cardviews)) continue
    const group = typeof list.header === 'string' ? list.header : ''
    for (const v of list.cardviews as CardView[]) {
      if (typeof v.name !== 'string') continue
      const key = cardKey(v.name)
      if (out.has(key) || skip.has(key) || banned.has(key)) continue
      const decks = typeof v.num_decks === 'number' ? v.num_decks : 0
      const potential = typeof v.potential_decks === 'number' && v.potential_decks > 0 ? v.potential_decks : 0
      out.set(key, {
        name: v.name,
        inclusion: potential ? decks / potential : 0,
        synergy: typeof v.synergy === 'number' ? v.synergy : 0,
        group,
      })
    }
  }
  return [...out.values()].sort((a, b) => b.inclusion - a.inclusion || b.synergy - a.synergy)
}

type Fetch = typeof fetch

/** Load EDHREC's page for a commander. Remembers the last one, so it also works offline later. */
export async function fetchCommanderPage(commander: string, fetchImpl: Fetch = fetch, storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): Promise<unknown> {
  const slug = commanderSlug(commander)
  let cached: unknown = null
  try {
    const stored = JSON.parse(storage?.getItem(CACHE_KEY) ?? 'null') as { slug?: string; page?: unknown } | null
    if (stored?.slug === slug) cached = stored.page
  } catch {
    // Broken cache: load again.
  }
  if (cached && !navigatorOnline()) return cached
  let res: Response
  try {
    res = await fetchImpl(`${API}/${slug}.json`, { headers: { Accept: 'application/json' } })
  } catch {
    if (cached) return cached
    throw new Error('No connection. Suggestions need internet.')
  }
  if (res.status === 404 || res.status === 403) throw new Error('EDHREC doesn’t know this commander yet.')
  if (!res.ok) throw new Error(`EDHREC responded with ${res.status}`)
  const page: unknown = await res.json()
  try {
    // Only the card lists, so the cache stays small.
    const lists = (page as { container?: { json_dict?: { cardlists?: CardList[] } } }).container?.json_dict?.cardlists ?? []
    const slim = lists.map((l) => ({
      header: l.header,
      tag: l.tag,
      cardviews: Array.isArray(l.cardviews)
        ? (l.cardviews as CardView[]).map(({ name, synergy, num_decks, potential_decks }) => ({ name, synergy, num_decks, potential_decks }))
        : [],
    }))
    storage?.setItem(CACHE_KEY, JSON.stringify({ slug, page: { container: { json_dict: { cardlists: slim } } } }))
  } catch {
    // Storage full: suggestions still work this time.
  }
  return page
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const navigatorOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false
