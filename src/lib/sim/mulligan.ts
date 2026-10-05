import { isCreature, isLand, manaAbility, type CardInfo } from '../cards'

// Faustregel aus dem Lernplan: „Behalte Hände mit 3–4 Ländern oder Manakreaturen
// plus mindestens einer frühen dicken Kreatur.“ Der erste Mulligan ist gratis.

export interface HandReport {
  lands: number
  /** Manakreaturen und Mana-Artefakte (z. B. Sol Ring). */
  ramp: number
  /** Kreaturen mit Stärke 4+ für höchstens 4 Mana. */
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

  const landWord = (n: number) => `${n} ${n === 1 ? 'Land' : 'Länder'}`
  const rampText = ramp > 0 ? ` und ${ramp} Mana-Beschleuniger` : ''

  let manaOk = true
  if (lands < 2) {
    manaOk = false
    reasons.push(`Nur ${landWord(lands)}${rampText}: zu wenig, um sicher loszulegen.`)
  } else if (sources < 3) {
    manaOk = false
    reasons.push(`${landWord(lands)}${rampText}: unter 3 Manaquellen.`)
  } else if (sources > 5 || lands > 5) {
    manaOk = false
    reasons.push(`${landWord(lands)}${rampText}: zu viel Mana, zu wenig Druck.`)
  } else {
    reasons.push(`${landWord(lands)}${rampText}: das Mana passt.`)
  }

  if (earlyBig.length > 0) reasons.push(`Frühe dicke Kreatur: ${earlyBig.join(', ')}.`)
  else reasons.push('Keine frühe dicke Kreatur (Stärke 4+ für höchstens 4 Mana).')

  return { lands, ramp, earlyBig, keep: manaOk && earlyBig.length > 0, reasons }
}

/** Lockerere Regel nach einem Mulligan: Hauptsache das Mana passt. */
export function manaIsFine(hand: (CardInfo | null)[]): boolean {
  const cards = hand.filter((c): c is CardInfo => c !== null)
  const lands = cards.filter(isLand).length
  const sources = lands + cards.filter(isRamp).length
  return lands >= 2 && sources >= 3 && sources <= 5
}
