// Compact card data (from Scryfall) and helpers to read it for the quiz and simulation.

import { ANY, maskOf } from './mana'

export interface CardInfo {
  name: string
  typeLine: string
  manaCost: string
  cmc: number
  /** Power as a number; null for "*" or non-creatures. */
  power: number | null
  powerText: string | null
  toughness: string | null
  oracleText: string
  producedMana: string[]
  keywords: string[]
  /** Small card image (for lists and hands). */
  image: string | null
  /** Larger card image (for the detail view). */
  imageLarge: string | null
  /** Artwork only (for the card quiz). */
  art: string | null
  scryfallUri: string
  /** Printing: set code (lower case) and name, collector number. */
  set: string
  setName: string
  collectorNumber: string
  /**
   * If a specific printing was requested that Scryfall doesn't have, this holds
   * the requested set; a different version was delivered instead.
   */
  requestedSet?: string
}

export const cardKey = (name: string) => name.trim().toLowerCase()

export const isLand = (c: CardInfo) => /\bLand\b/.test(c.typeLine) && !/\bCreature\b/.test(c.typeLine)
export const isCreature = (c: CardInfo) => /\bCreature\b/.test(c.typeLine)
export const isArtifact = (c: CardInfo) => /\bArtifact\b/.test(c.typeLine)

export interface ManaCost {
  generic: number
  /** One entry per colored or colorless symbol: the colors that can pay it (see mana.ts). */
  pips: number[]
  hasX: boolean
}

/** "{2}{G}{G}" → 2 generic, two pips that need green. Hybrid {G/U} accepts either color. */
export function parseCost(manaCost: string): ManaCost {
  const cost: ManaCost = { generic: 0, pips: [], hasX: false }
  for (const [, sym] of manaCost.matchAll(/\{([^}]+)\}/g)) {
    if (/^\d+$/.test(sym)) cost.generic += Number(sym)
    else if (/^[XYZ]$/.test(sym)) cost.hasX = true
    else if (sym === 'S') cost.generic += 1
    else if (/^2\/[WUBRG]$/.test(sym)) cost.generic += 2
    else if (/^[WUBRGC](\/[WUBRG])?(\/P)?$/.test(sym)) cost.pips.push(maskOf(sym[0]) | (sym[1] === '/' && sym[2] !== 'P' ? maskOf(sym[2]) : 0))
  }
  return cost
}

/** Colors a cost asks for (bit mask, without colorless). */
export const costColors = (cost: ManaCost) => cost.pips.reduce((m, p) => m | p, 0) & ANY

export interface ManaAbility {
  /** Mana per tap in the normal case. */
  amount: number
  /** Mana when you control a creature with power 4+ (Ilysian Caryatid, Whisperer of the Wilds). */
  ferociousAmount: number
  /** Which colors each mana can be (bit mask, see mana.ts), e.g. only {C} for Sol Ring. */
  mask: number
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3 }

/** One "Add …" clause: how much mana, which colors. */
function parseAdd(clause: string): { amount: number; mask: number } | null {
  const symbols = clause.match(/\{[WUBRGC]\}/g) ?? []
  let mask = symbols.reduce((m, s) => m | maskOf(s[1]), 0)
  if (/any color|any one color|commander's color identity|any combination of colors/i.test(clause)) mask |= ANY
  if (mask === 0) return null
  const word = clause.match(/^(one|two|three) mana/i)
  if (word) return { amount: NUMBER_WORDS[word[1].toLowerCase()], mask }
  // "{R} or {G}" and "{W}, {U}, or {B}" are one mana; "{C}{C}" is two.
  const first = clause.split(/,? or |, /)[0]
  return { amount: first.match(/\{[WUBRGC]\}/g)?.length || 1, mask }
}

/** Reads "{T}: Add …" from the rules text. null if the card produces no mana. */
export function manaAbility(card: CardInfo): ManaAbility | null {
  const text = card.oracleText
  const adds = [...text.matchAll(/\{T\}(?:,[^:]*)?: Add ([^.]+)\./g)].map((m) => parseAdd(m[1])).filter((a) => a !== null)
  if (adds.length === 0) {
    if (card.producedMana.length === 0) return null
    // Fallback: produced_mana without readable text (should be rare).
    return { amount: 1, ferociousAmount: 1, mask: card.producedMana.reduce((m, l) => m | maskOf(l), 0) }
  }

  const base = adds[0].amount
  let ferocious = base
  if (/power 4 or greater/i.test(text)) {
    const twoInstead = /add two mana/i.test(text) ? 2 : 0
    ferocious = Math.max(base, twoInstead, ...adds.map((a) => a.amount))
  }
  return { amount: base, ferociousAmount: ferocious, mask: adds.reduce((m, a) => m | a.mask, 0) }
}

/** Lands like Evolving Wilds that fetch a basic land instead of tapping for mana. */
export const fetchesLand = (card: CardInfo) =>
  isLand(card) && !manaAbility(card) && /search your library for [^.]*(basic land|land card|Plains|Island|Swamp|Mountain|Forest)/i.test(card.oracleText)

/** Spells and creatures that put a land from the library onto the battlefield (Cultivate, Wood Elves). */
export function rampsLand(card: CardInfo): { tapped: boolean } | null {
  if (isLand(card)) return null
  const m = card.oracleText.match(/search your library for [^.]*land[^.]*onto the battlefield( tapped)?/i)
  return m ? { tapped: m[1] !== undefined } : null
}

export const entersTapped = (card: CardInfo) => /enters( the battlefield)? tapped/i.test(card.oracleText)

/** Power on the battlefield, also for "*" creatures like Dungrove Elder (number of Forests). */
export function boardPower(card: CardInfo, forests: number): number {
  if (card.power !== null) return card.power
  if (card.powerText?.includes('*') && /number of Forests you control/i.test(card.oracleText)) return forests
  return 0
}

/** Raw data of a Scryfall card (only the fields we read). */
export interface ScryfallCard {
  name: string
  type_line?: string
  mana_cost?: string
  cmc?: number
  power?: string
  toughness?: string
  oracle_text?: string
  produced_mana?: string[]
  keywords?: string[]
  image_uris?: { small?: string; normal?: string; art_crop?: string }
  set?: string
  set_name?: string
  collector_number?: string
  card_faces?: {
    name: string
    type_line?: string
    mana_cost?: string
    power?: string
    toughness?: string
    oracle_text?: string
    image_uris?: { small?: string; normal?: string; art_crop?: string }
  }[]
  scryfall_uri?: string
}

/** Convert a Scryfall card into our compact format (for double-faced cards the front face counts). */
export function fromScryfall(raw: ScryfallCard): CardInfo {
  const front = raw.card_faces?.[0]
  const powerText = raw.power ?? front?.power ?? null
  const images = raw.image_uris ?? front?.image_uris
  return {
    name: raw.name,
    typeLine: raw.type_line ?? front?.type_line ?? '',
    manaCost: raw.mana_cost || front?.mana_cost || '',
    cmc: raw.cmc ?? 0,
    power: powerText !== null && /^\d+$/.test(powerText) ? Number(powerText) : null,
    powerText,
    toughness: raw.toughness ?? front?.toughness ?? null,
    oracleText: raw.oracle_text ?? raw.card_faces?.map((f) => f.oracle_text ?? '').join('\n') ?? '',
    producedMana: raw.produced_mana ?? [],
    keywords: raw.keywords ?? [],
    image: images?.small ?? null,
    imageLarge: images?.normal ?? null,
    art: images?.art_crop ?? null,
    scryfallUri: raw.scryfall_uri ?? '',
    set: raw.set ?? '',
    setName: raw.set_name ?? '',
    collectorNumber: raw.collector_number ?? '',
  }
}
