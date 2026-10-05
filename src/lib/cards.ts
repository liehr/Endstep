// Compact card data (from Scryfall) and helpers to read it for the quiz and simulation.

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
  /** Green symbols (incl. hybrid/Phyrexian green). */
  green: number
  /** Other colored symbols (W/U/B/R) – the green deck can't pay these. */
  otherColors: number
  hasX: boolean
}

/** "{2}{G}{G}" → 2 generic, 2 green. */
export function parseCost(manaCost: string): ManaCost {
  const cost: ManaCost = { generic: 0, green: 0, otherColors: 0, hasX: false }
  for (const [, sym] of manaCost.matchAll(/\{([^}]+)\}/g)) {
    if (/^\d+$/.test(sym)) cost.generic += Number(sym)
    else if (sym === 'X') cost.hasX = true
    else if (sym === 'C') cost.generic += 1
    else if (sym.includes('G')) cost.green += 1
    else if (/^[WUBR](\/P)?$/.test(sym) || /^[WUBR]\/[WUBR]$/.test(sym)) cost.otherColors += 1
    else if (/^2\/[WUBR]$/.test(sym)) cost.generic += 2
  }
  return cost
}

export interface ManaAbility {
  /** Mana per tap in the normal case. */
  amount: number
  /** Mana when you control a creature with power 4+ (Ilysian Caryatid, Whisperer of the Wilds). */
  ferociousAmount: number
  /** Can it produce green mana? (Otherwise colorless only, e.g. Sol Ring.) */
  green: boolean
}

/** Reads "{T}: Add …" from the rules text. null if the card produces no mana. */
export function manaAbility(card: CardInfo): ManaAbility | null {
  const text = card.oracleText
  const clauses = [...text.matchAll(/\{T\}(?:,[^:]*)?: Add ([^.]+)\./g)].map((m) => m[1])
  if (clauses.length === 0) {
    if (card.producedMana.length === 0) return null
    // Fallback: produced_mana without readable text (should be rare).
    return { amount: 1, ferociousAmount: 1, green: card.producedMana.includes('G') }
  }

  const amountOf = (clause: string) => {
    const symbols = clause.match(/\{[WUBRGC]\}/g)?.length ?? 0
    if (symbols > 0) return symbols
    if (/^two mana/i.test(clause)) return 2
    if (/^three mana/i.test(clause)) return 3
    if (/^one mana/i.test(clause)) return 1
    return 0
  }

  const amounts = clauses.map(amountOf).filter((n) => n > 0)
  if (amounts.length === 0) return null
  const base = amounts[0]
  let ferocious = base
  if (/power 4 or greater/i.test(text)) {
    const twoInstead = /add two mana/i.test(text) ? 2 : 0
    ferocious = Math.max(base, twoInstead, ...amounts)
  }
  const green = clauses.some((c) => /\{G\}|any color|any one color|commander's color identity/i.test(c))
  return { amount: base, ferociousAmount: ferocious, green }
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
