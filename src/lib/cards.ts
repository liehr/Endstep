// Kompakte Kartendaten (aus Scryfall) und Helfer, um sie für Quiz und Simulation zu lesen.

export interface CardInfo {
  name: string
  typeLine: string
  manaCost: string
  cmc: number
  /** Stärke als Zahl; null bei „*“ oder Nicht-Kreaturen. */
  power: number | null
  powerText: string | null
  toughness: string | null
  oracleText: string
  producedMana: string[]
  keywords: string[]
  /** Kleines Kartenbild (für Listen und Hände). */
  image: string | null
  /** Größeres Kartenbild (für die Detailansicht). */
  imageLarge: string | null
  /** Nur das Artwork (für das Karten-Quiz). */
  art: string | null
  scryfallUri: string
  /** Druckversion: Set-Code (klein) und Name, Sammlernummer. */
  set: string
  setName: string
  collectorNumber: string
  /**
   * Wurde eine bestimmte Druckversion angefragt, die es bei Scryfall nicht gibt,
   * steht hier das gewünschte Set; geliefert wurde dann eine andere Version.
   */
  requestedSet?: string
}

export const cardKey = (name: string) => name.trim().toLowerCase()

export const isLand = (c: CardInfo) => /\bLand\b/.test(c.typeLine) && !/\bCreature\b/.test(c.typeLine)
export const isCreature = (c: CardInfo) => /\bCreature\b/.test(c.typeLine)
export const isArtifact = (c: CardInfo) => /\bArtifact\b/.test(c.typeLine)

export interface ManaCost {
  generic: number
  /** Grüne Symbole (inkl. Hybrid-/Phyrexia-Grün). */
  green: number
  /** Andere farbige Symbole (W/U/B/R) – kann das grüne Deck nicht bezahlen. */
  otherColors: number
  hasX: boolean
}

/** „{2}{G}{G}“ → 2 generisch, 2 grün. */
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
  /** Mana pro Tappen im Normalfall. */
  amount: number
  /** Mana, wenn man eine Kreatur mit Stärke 4+ kontrolliert (Ilysian Caryatid, Whisperer of the Wilds). */
  ferociousAmount: number
  /** Kann es grünes Mana erzeugen? (Sonst nur farblos, z. B. Sol Ring.) */
  green: boolean
}

/** Liest „{T}: Add …“ aus dem Regeltext. null, wenn die Karte kein Mana erzeugt. */
export function manaAbility(card: CardInfo): ManaAbility | null {
  const text = card.oracleText
  const clauses = [...text.matchAll(/\{T\}(?:,[^:]*)?: Add ([^.]+)\./g)].map((m) => m[1])
  if (clauses.length === 0) {
    if (card.producedMana.length === 0) return null
    // Fallback: produced_mana ohne lesbaren Text (sollte selten sein).
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

/** Stärke auf dem Feld, auch für „*“-Kreaturen wie Dungrove Elder (Anzahl Wälder). */
export function boardPower(card: CardInfo, forests: number): number {
  if (card.power !== null) return card.power
  if (card.powerText?.includes('*') && /number of Forests you control/i.test(card.oracleText)) return forests
  return 0
}

/** Rohdaten einer Scryfall-Karte (nur die Felder, die wir lesen). */
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

/** Scryfall-Karte in unser kompaktes Format übersetzen (bei doppelseitigen Karten zählt die Vorderseite). */
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
