import type { DeckEntry } from './types'

// Tramplesaurus Rex (Foundations Commander Decks), as released.
// Source: decklists from Wizards/EDHREC/playgroup.gg. Can be changed in the app at any time.

export const DEFAULT_COMMANDER = 'Ghalta, Primal Hunger'
/** Foundations Commander Decks – set code on Scryfall. */
export const DEFAULT_SET = 'fdc'
/** The same precon on MTGJSON (see precons.ts). */
export const DEFAULT_PRECON = 'TramplesaurusRex_FDC'

const DEFAULT_LIST_TEXT = `
1 Arasta of the Endless Web
1 Beast Whisperer
1 Birds of Paradise
1 Carnage Tyrant
1 Challenger Troll
1 Clifftop Lookout
1 Curious Altisaur
1 Dungrove Elder
1 Elder Gargaroth
1 Elvish Mystic
1 Fyndhorn Elves
1 Garruk's Packleader
1 Gigantosaurus
1 Goreclaw, Terror of Qal Sisma
1 Hulking Raptor
1 Ilysian Caryatid
1 Llanowar Elves
1 Llanowar Tribe
1 Loot, Exuberant Explorer
1 Managorger Hydra
1 Paradise Druid
1 Pugnacious Hammerskull
1 Regal Imperiosaur
1 Rhonas the Indomitable
1 Ripjaw Raptor
1 Rishkar, Peema Renegade
1 Scavenging Ooze
1 Scrapshooter
1 Steel Leaf Champion
1 Surrak and Goreclaw
1 Surrak, the Hunt Caller
1 Terrian, World Tyrant
1 Thrashing Brontodon
1 Verdant Sun's Avatar
1 Whiptongue Hydra
1 Whisperer of the Wilds
1 Yeva, Nature's Herald
1 Arachnogenesis
1 Beast Within
1 Bite Down
1 Collective Resistance
1 Ram Through
1 Tamiyo's Safekeeping
1 Ezuri's Predation
1 Harmonize
1 Monstrous Onslaught
1 Overwhelming Stampede
1 Rishkar's Expertise
1 Shamanic Revelation
1 Colossal Majesty
1 Elemental Bond
1 Garruk's Uprising
1 Kenrith's Transformation
1 Thickest in the Thicket
1 Unnatural Growth
1 Commander's Sphere
1 Rhonas's Monument
1 Sol Ring
1 Swiftfoot Boots
1 Tangleweave Armor
1 Bonders' Enclave
32 Forest
1 Mosswort Bridge
1 Rogue's Passage
1 Scavenger Grounds
1 Tranquil Thicket
1 War Room
1 Witch's Clinic
`

export const deckSize = (entries: DeckEntry[]) => entries.reduce((sum, e) => sum + e.qty, 0)

const key = (name: string) => name.trim().toLowerCase()

/** Section headings from Moxfield, Arena, Archidekt … */
const SECTION_RE =
  /^(\/\/\s*)?(commanders?|deck|mainboard|main|sideboard|maybeboard|companion|creatures?|instants?|sorcer(?:y|ies)|enchantments?|artifacts?|lands?|planeswalkers?|other)\s*(\(\d+\))?\s*:?\s*$/i

export interface ParsedDecklist {
  commander: string | null
  commanderSet: string | null
  entries: DeckEntry[]
  /** Lines that could not be understood. */
  errors: string[]
}

/**
 * Reads a decklist as text, e.g. from Moxfield, Archidekt or MTG Arena:
 * "1 Llanowar Elves", "1x Llanowar Elves (FDN) 227 *F*", sections like "Commander".
 */
export function parseDecklist(text: string): ParsedDecklist {
  const entries = new Map<string, DeckEntry>()
  const errors: string[] = []
  let commander: string | null = null
  let commanderSet: string | null = null
  let section = ''

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const sectionMatch = line.match(SECTION_RE)
    if (sectionMatch) {
      section = sectionMatch[2].toLowerCase()
      continue
    }
    if (/^(\/\/|#)/.test(line)) continue
    if (/^(sideboard|maybeboard)/.test(section)) continue

    const m = line.match(/^(\d+)\s*x?\s+(.+)$/i) ?? line.match(/^()(.+)$/)
    if (!m) {
      errors.push(line)
      continue
    }
    const qty = m[1] ? Number(m[1]) : 1
    let rest = m[2]
      .replace(/\s+\*[A-Z]+\*\s*$/i, '') // *F*, *E* (foil markers)
      .replace(/\s+\[[^\]]*\]\s*$/, '') // [category] from Archidekt
      .trim()
    // (SET) 123 → remember the printing
    const printing = rest.match(/\s+\(([A-Z0-9]{2,6})\)(?:\s+([\w★-]+))?\s*$/i)
    if (printing) rest = rest.slice(0, printing.index).trim()
    const name = rest
    const set = printing?.[1].toLowerCase()
    const number = printing?.[2]
    if (!name || qty < 1 || qty > 99) {
      errors.push(line)
      continue
    }
    if (section.startsWith('commander')) {
      commander = name
      commanderSet = set ?? null
      continue
    }
    const existing = entries.get(key(name))
    if (existing) existing.qty += qty
    else entries.set(key(name), { name, qty, ...(set ? { set } : {}), ...(number ? { number } : {}) })
  }

  return { commander, commanderSet, entries: [...entries.values()], errors }
}

const printingText = (set?: string | null, number?: string) => (set ? ` (${set.toUpperCase()})${number ? ` ${number}` : ''}` : '')

export function serializeDecklist(commander: string, entries: DeckEntry[], commanderSet: string | null = null): string {
  return [
    'Commander',
    `1 ${commander}${printingText(commanderSet)}`,
    '',
    'Deck',
    ...entries.map((e) => `${e.qty} ${e.name}${printingText(e.set, e.number)}`),
  ].join('\n')
}

/** Swap cards: remove one copy of each "out", add each "in". */
export function applySwap(entries: DeckEntry[], out: string[], into: string[]): DeckEntry[] {
  const result = entries.map((e) => ({ ...e }))
  for (const name of out) {
    const entry = result.find((e) => key(e.name) === key(name))
    if (entry) entry.qty--
  }
  for (const name of into) {
    const entry = result.find((e) => key(e.name) === key(name))
    if (entry) entry.qty++
    else result.push({ name: name.trim(), qty: 1 })
  }
  return result.filter((e) => e.qty > 0)
}

export function sameDecklist(a: DeckEntry[], b: DeckEntry[]): boolean {
  if (a.length !== b.length) return false
  const map = new Map(a.map((e) => [key(e.name), e.qty]))
  return b.every((e) => map.get(key(e.name)) === e.qty)
}

export const isBasicLand = (name: string) => /^(snow-covered )?(forest|island|swamp|mountain|plains|wastes)$/i.test(name.trim())

/** All card names of a deck (without basic lands), alphabetically. */
export function deckCardNames(entries: DeckEntry[]): string[] {
  return entries
    .map((e) => e.name)
    .filter((n) => !isBasicLand(n))
    .sort((a, b) => a.localeCompare(b, 'en'))
}

// Defined at the end because parseDecklist needs the constants above.
export const DEFAULT_DECKLIST: DeckEntry[] = parseDecklist(DEFAULT_LIST_TEXT).entries.map((e) => ({ ...e, set: DEFAULT_SET }))
