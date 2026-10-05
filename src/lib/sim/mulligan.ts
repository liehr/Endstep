import { fetchesLand, isCreature, isLand, manaAbility, parseCost, rampsLand, type CardInfo } from '../cards'
import { ANY } from '../mana'

// Rule of thumb from the study plan: "Keep hands with 3–4 lands or mana sources plus
// something to do early, in the right colors." The first mulligan is free.
// Decks built around big creatures (Ghalta) want an early big creature instead.

export interface HandRule {
  /** Big-creature deck: wants a creature with power 4+ for at most 4 mana. */
  bigCreature: boolean
}

export const DEFAULT_RULE: HandRule = { bigCreature: false }

export interface HandReport {
  lands: number
  /** Mana creatures, mana rocks and land ramp (e.g. Sol Ring, Cultivate). */
  ramp: number
  /** Early plays: creatures with power 4+ for at most 4 mana (big-creature rule) or spells for at most 3 mana. */
  early: string[]
  keep: boolean
  reasons: string[]
}

/** The rule in one sentence, for explanations. */
export const ruleText = (rule: HandRule) =>
  rule.bigCreature
    ? '3–4 lands or mana sources plus an early big creature'
    : '3–4 lands or mana sources plus something to cast in the first turns, in the right colors'

export const isRamp = (c: CardInfo) => !isLand(c) && (manaAbility(c) !== null || rampsLand(c) !== null)
export const isEarlyBig = (c: CardInfo) => isCreature(c) && !isRamp(c) && (c.power ?? 0) >= 4 && c.cmc <= 4

/** Colors the lands and mana sources in a hand can make. */
function handColors(cards: CardInfo[]): number {
  return cards.reduce((mask, c) => {
    if (fetchesLand(c) || rampsLand(c)) return mask | ANY
    const ability = isLand(c) || isRamp(c) ? manaAbility(c) : null
    return ability ? mask | ability.mask : mask
  }, 0)
}

/** Can the hand's mana sources make every colored symbol of this card (ignoring how much mana)? */
const colorsFit = (c: CardInfo, colors: number) => parseCost(c.manaCost).pips.every((pip) => pip & colors)

export function evaluateHand(hand: (CardInfo | null)[], rule: HandRule = DEFAULT_RULE): HandReport {
  const cards = hand.filter((c): c is CardInfo => c !== null)
  const lands = cards.filter(isLand).length
  const ramp = cards.filter(isRamp).length
  const colors = handColors(cards)
  const spells = cards.filter((c) => !isLand(c))
  const early = rule.bigCreature
    ? cards.filter(isEarlyBig).map((c) => c.name)
    : spells.filter((c) => c.cmc <= 3 && colorsFit(c, colors)).map((c) => c.name)
  const sources = lands + ramp
  const reasons: string[] = []

  const landWord = (n: number) => `${n} ${n === 1 ? 'land' : 'lands'}`
  const rampText = ramp > 0 ? ` and ${ramp} ramp ${ramp === 1 ? 'piece' : 'pieces'}` : ''

  let manaOk = true
  if (lands < 2) {
    manaOk = false
    reasons.push(`Only ${landWord(lands)}${rampText}: too few to get going safely.`)
  } else if (sources < 3) {
    manaOk = false
    reasons.push(`${landWord(lands)}${rampText}: fewer than 3 mana sources.`)
  } else if (sources > 5 || lands > 5) {
    manaOk = false
    reasons.push(`${landWord(lands)}${rampText}: too much mana, too little pressure.`)
  } else {
    reasons.push(`${landWord(lands)}${rampText}: the mana works.`)
  }

  // Lands that can't cast any of the spells in hand.
  let colorsOk = true
  if (manaOk && spells.length > 0 && !spells.some((c) => colorsFit(c, colors))) {
    colorsOk = false
    reasons.push('Your lands don’t make the colors your spells need.')
  }

  if (rule.bigCreature) {
    if (early.length > 0) reasons.push(`Early big creature: ${early.join(', ')}.`)
    else reasons.push('No early big creature (power 4+ for at most 4 mana).')
  } else if (early.length > 0) reasons.push(`Early plays: ${early.join(', ')}.`)
  else if (colorsOk) reasons.push('Nothing to cast in the first three turns.')

  return { lands, ramp, early, keep: manaOk && colorsOk && early.length > 0, reasons }
}

/** Looser rule after a mulligan: as long as the mana works. */
export function manaIsFine(hand: (CardInfo | null)[]): boolean {
  const cards = hand.filter((c): c is CardInfo => c !== null)
  const lands = cards.filter(isLand).length
  const sources = lands + cards.filter(isRamp).length
  return lands >= 2 && sources >= 3 && sources <= 5
}
