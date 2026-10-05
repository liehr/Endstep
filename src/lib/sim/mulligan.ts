import { isCreature, isLand, manaAbility, type CardInfo } from '../cards'

// Rule of thumb from the study plan: "Keep hands with 3–4 lands or mana creatures
// plus at least one early big creature." The first mulligan is free.

export interface HandReport {
  lands: number
  /** Mana creatures and mana artifacts (e.g. Sol Ring). */
  ramp: number
  /** Creatures with power 4+ for at most 4 mana. */
  earlyBig: string[]
  keep: boolean
  reasons: string[]
}

export const isRamp = (c: CardInfo) => !isLand(c) && manaAbility(c) !== null
export const isEarlyBig = (c: CardInfo) => isCreature(c) && !isRamp(c) && (c.power ?? 0) >= 4 && c.cmc <= 4

export function evaluateHand(hand: (CardInfo | null)[]): HandReport {
  const cards = hand.filter((c): c is CardInfo => c !== null)
  const lands = cards.filter(isLand).length
  const ramp = cards.filter(isRamp).length
  const earlyBig = cards.filter(isEarlyBig).map((c) => c.name)
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

  if (earlyBig.length > 0) reasons.push(`Early big creature: ${earlyBig.join(', ')}.`)
  else reasons.push('No early big creature (power 4+ for at most 4 mana).')

  return { lands, ramp, earlyBig, keep: manaOk && earlyBig.length > 0, reasons }
}

/** Looser rule after a mulligan: as long as the mana works. */
export function manaIsFine(hand: (CardInfo | null)[]): boolean {
  const cards = hand.filter((c): c is CardInfo => c !== null)
  const lands = cards.filter(isLand).length
  const sources = lands + cards.filter(isRamp).length
  return lands >= 2 && sources >= 3 && sources <= 5
}
