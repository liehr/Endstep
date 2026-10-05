import { costColors, isCreature, isLand, manaAbility, parseCost, type CardInfo } from '../cards'
import { bits, COLOR_LETTERS, lettersOf } from '../mana'
import { shuffle, type Rng } from '../sim/rng'

// Card quiz: parts of a card are hidden (name, cost, power, type, a bit of text),
// you guess them or rebuild them from tiles. Plus: what role does the card play in the gameplan?

export type Role = 'land' | 'ramp' | 'big' | 'draw' | 'removal' | 'protection' | 'finisher' | 'utility'

export const ROLES: Record<Role, { label: string; hint: string }> = {
  land: { label: 'Land', hint: 'Brings mana every turn. No lands, no spells.' },
  ramp: { label: 'Ramp', hint: 'Extra mana or cheaper spells, so your commander and big spells land sooner.' },
  big: { label: 'Big creature', hint: 'Lots of power: pressures the table and pushes damage through.' },
  draw: { label: 'Card advantage', hint: 'Draws cards so you don’t run out of gas after a wipe.' },
  removal: { label: 'Interaction', hint: 'Removes opposing threats. The deck has little of it, so use it carefully.' },
  protection: { label: 'Protection', hint: 'Protects your creatures from removal or wipes. Save it for the answer that would really kill you.' },
  finisher: { label: 'Finisher', hint: 'Turns a big board into a lethal attack.' },
  utility: { label: 'Utility', hint: 'Smaller card with a useful effect.' },
}

const RE = {
  ramp: /search your library for [^.]*land|onto the battlefield[^.]*land|land card[^.]*onto the battlefield|additional land|spells you cast[^.]*cost \{\d+\} less|\badd \{[WUBRGC]\}/i,
  removal:
    /destroy target|destroy all|exile target|deals damage equal to its power to target|deals x damage|damage divided|fights? (up to one )?target|loses all abilities/i,
  protection: /hexproof|indestructible|protection from|phase out|prevent all combat damage/i,
  finisher: /creatures you control (gain trample|get \+|have trample)|double the power|\+x\/\+x/i,
  draw: /draws? (a|one|two|three|four|x|\w+) cards?|draw cards equal|draw a card for each/i,
}

/** A card's role(s) by rule of thumb. confident = exactly one role fits. */
export function classify(card: CardInfo): { role: Role; roles: Role[]; confident: boolean } {
  if (isLand(card)) return { role: 'land', roles: ['land'], confident: true }
  const text = card.oracleText
  const roles: Role[] = []
  if (manaAbility(card) || RE.ramp.test(text)) roles.push('ramp')
  if (isCreature(card)) {
    const p = card.power ?? 0
    if (p >= 5 || (p >= 4 && card.cmc <= 4)) roles.push('big')
    if (RE.removal.test(text)) roles.push('removal')
    if (RE.draw.test(text)) roles.push('draw')
  } else {
    if (RE.removal.test(text)) roles.push('removal')
    if (RE.draw.test(text)) roles.push('draw')
    if (RE.protection.test(text)) roles.push('protection')
    if (RE.finisher.test(text)) roles.push('finisher')
  }
  if (roles.length === 0) return { role: 'utility', roles: ['utility'], confident: false }
  return { role: roles[0], roles, confident: roles.length === 1 }
}

// --- Card display ----------------------------------------------------------------

/** Frame color: one per color, gold for multicolor, gray for artifacts and colorless cards. */
export type Frame = 'white' | 'blue' | 'black' | 'red' | 'green' | 'artifact' | 'land' | 'multi'

const FRAME_BY_LETTER: Record<string, Frame> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' }

export type FieldId = 'name' | 'cost' | 'type' | 'pt' | 'gap'

/** Placeholder for a blank in the rules text. */
export const GAP = '⦁'

export interface CardFace {
  name: string
  manaCost: string
  typeLine: string
  text: string
  pt: string | null
  art: string | null
  /** Frame color by card kind. */
  frame: Frame
}

export const typeLabel = (c: CardInfo): string => {
  const t = c.typeLine
  if (/\bLand\b/.test(t)) return 'Land'
  if (/\bCreature\b/.test(t)) return 'Creature'
  if (/\bInstant\b/.test(t)) return 'Instant'
  if (/\bSorcery\b/.test(t)) return 'Sorcery'
  if (/\bEnchantment\b/.test(t)) return 'Enchantment'
  if (/\bArtifact\b/.test(t)) return 'Artifact'
  if (/\bPlaneswalker\b/.test(t)) return 'Planeswalker'
  return 'Other'
}

export function frameOf(c: CardInfo): Frame {
  if (isLand(c)) return 'land'
  const colors = costColors(parseCost(c.manaCost))
  if (bits(colors) > 1) return 'multi'
  if (colors === 0) return 'artifact'
  return FRAME_BY_LETTER[lettersOf(colors)[0]]
}

/** Hide the card name in the text (including the short form “Rhonas” for “Rhonas the Indomitable”). */
export function hideSelfName(text: string, name: string): string {
  const variants = [name, name.split(',')[0], name.split(' the ')[0]].filter((v, i, a) => v.length > 2 && a.indexOf(v) === i)
  return variants.reduce((t, v) => t.split(v).join('~'), text)
}

export function faceOf(c: CardInfo): CardFace {
  return {
    name: c.name,
    manaCost: c.manaCost,
    typeLine: c.typeLine,
    text: c.oracleText,
    pt: c.powerText !== null && c.toughness !== null ? `${c.powerText}/${c.toughness}` : null,
    art: c.art,
    frame: frameOf(c),
  }
}

// --- Variants for wrong answers ------------------------------------------------------

/** Cost in card notation: {X}, then generic, then the colored symbols as given. */
export function formatCost(generic: number, symbols: string[], x = false): string {
  return `${x ? '{X}' : ''}${generic > 0 ? `{${generic}}` : ''}${symbols.map((s) => `{${s}}`).join('')}`
}

/** Plausible wrong costs: a bit more or less generic, one colored symbol more or less, another color. */
export function costVariants(manaCost: string): string[] {
  const all = [...manaCost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
  const x = all.includes('X')
  const generic = all.filter((sym) => /^\d+$/.test(sym)).reduce((sum, sym) => sum + Number(sym), 0)
  const colored = all.filter((sym) => !/^\d+$/.test(sym) && sym !== 'X')
  const out = new Set<string>()
  const add = (gen: number, symbols: string[]) => {
    if (gen >= 0 && gen + symbols.length > 0) out.add(formatCost(gen, symbols, x))
  }
  const first = colored[0]
  add(generic + 1, colored)
  add(generic - 1, colored)
  if (first) add(generic, [...colored, first])
  if (colored.length > 1) add(generic + 1, colored.slice(1))
  add(generic + 2, colored)
  if (first) add(generic - 1, [...colored, first])
  // Same amount, wrong color: the next color in WUBRG order.
  if (first && /^[WUBRG]$/.test(first)) {
    const other = COLOR_LETTERS[(COLOR_LETTERS.indexOf(first as never) + 1) % COLOR_LETTERS.length]
    add(generic, colored.map((sym) => (sym === first ? other : sym)))
  }
  out.delete(manaCost)
  return [...out]
}

export function ptVariants(pt: string): string[] {
  const [p, t] = pt.split('/').map(Number)
  if (Number.isNaN(p) || Number.isNaN(t)) return []
  const out = new Set([`${t}/${p}`, `${p + 1}/${t}`, `${p - 1}/${t}`, `${p}/${t + 1}`, `${p + 2}/${t + 2}`, `${Math.max(0, p - 2)}/${t}`])
  out.delete(pt)
  return [...out].filter((v) => !v.startsWith('-'))
}

const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const KEYWORDS = ['Flying', 'Trample', 'Hexproof', 'Reach', 'Vigilance', 'Haste', 'Deathtouch', 'Indestructible', 'Flash', 'Lifelink', 'Ward']

export interface Gap {
  /** Text with the GAP placeholder at the blank. */
  text: string
  answer: string
  wrong: string[]
}

/** Find a meaningful blank in the rules text: number word, number, keyword or mana. */
export function findGap(text: string, rng: Rng): Gap | null {
  const candidates: Gap[] = []
  const replaceAt = (index: number, length: number) => text.slice(0, index) + GAP + text.slice(index + length)

  for (const m of text.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi)) {
    const word = m[1]
    const lower = word.toLowerCase()
    const idx = NUMBER_WORDS.indexOf(lower)
    const near = NUMBER_WORDS.filter((w, i) => w !== lower && Math.abs(i - idx) <= 2)
    const cased = (w: string) => (word[0] === word[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w)
    candidates.push({ text: replaceAt(m.index!, word.length), answer: word, wrong: near.map(cased) })
  }
  for (const m of text.matchAll(/(power|toughness) (\d+) or greater|\+(\d+)\/\+\3/g)) {
    const num = m[2] ?? m[3]
    const n = Number(num)
    const start = m.index! + m[0].indexOf(num)
    candidates.push({ text: replaceAt(start, num.length), answer: num, wrong: [n - 1, n + 1, n + 2].filter((x) => x > 0).map(String) })
  }
  for (const kw of KEYWORDS) {
    const m = text.match(new RegExp(`\\b${kw}\\b`, 'i'))
    if (m && m.index !== undefined) {
      const answer = text.slice(m.index, m.index + kw.length)
      const cased = (w: string) => (answer[0] === answer[0].toUpperCase() ? w : w.toLowerCase())
      candidates.push({
        text: replaceAt(m.index, kw.length),
        answer,
        wrong: KEYWORDS.filter((k) => k !== kw && !new RegExp(`\\b${k}\\b`, 'i').test(text)).map(cased),
      })
    }
  }
  const add = text.match(/Add ((?:\{[WUBRGC]\})+)/)
  if (add && add.index !== undefined) {
    const start = add.index + 4
    // Wrong answers: the same color one more or less, and colorless.
    const color = add[1][1] === 'C' ? 'G' : add[1][1]
    const groups = [`{${color}}`, `{${color}}{${color}}`, `{${color}}{${color}}{${color}}`, '{C}', '{C}{C}']
    candidates.push({ text: replaceAt(start, add[1].length), answer: add[1], wrong: groups.filter((g) => g !== add[1]) })
  }

  const usable = candidates.filter((c) => c.wrong.length >= 2)
  if (usable.length === 0) return null
  const gap = usable[Math.floor(rng() * usable.length)]
  return { ...gap, wrong: shuffle(gap.wrong, rng).slice(0, 3) }
}
