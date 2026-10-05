import {
  boardPower,
  entersTapped,
  isArtifact,
  isCreature,
  isLand,
  manaAbility,
  parseCost,
  type CardInfo,
} from '../cards'
import type { DeckEntry } from '../types'
import { evaluateHand, manaIsFine } from './mulligan'
import { mulberry32, shuffle, type Rng } from './rng'

// „Goldfishing“: Das Deck allein durchspielen, ohne Gegner. Ein einfacher Autopilot
// spielt Länder, Mana-Beschleuniger und die stärksten bezahlbaren Kreaturen und castet
// Ghalta, sobald es geht. Bewusst simpel – es geht um ein Gefühl für das Tempo des Decks.

/** Eine Karte in der Simulation. info = null, wenn die Kartendaten (noch) fehlen. */
export interface SimCard {
  name: string
  info: CardInfo | null
}

interface Permanent {
  card: CardInfo
  /** Kreaturen können erst im nächsten Zug tappen. */
  sick: boolean
  /** Getappt reingekommen (z. B. Tranquil Thicket). */
  tapped: boolean
}

export interface TurnLog {
  turn: number
  drew: string | null
  land: string | null
  cast: string[]
  /** Gesamtstärke zu Beginn des Zugs (vor dem Ausspielen). */
  powerAtStart: number
  /** Kreaturen auf dem Feld zu Beginn des Zugs. */
  boardAtStart: string[]
  /** Gesamtstärke am Ende des Zugs. */
  power: number
  /** Verfügbares Mana zu Beginn der Hauptphase. */
  mana: number
  ghalta: boolean
}

export interface GameSim {
  hand: SimCard[]
  mulligans: number
  /** Zug, in dem Ghalta gecastet wurde; null, wenn nicht bis zum Limit. */
  ghaltaTurn: number | null
  log: TurnLog[]
}

export const MAX_TURNS = 12

export function buildLibrary(decklist: DeckEntry[], lookup: (name: string) => CardInfo | undefined): SimCard[] {
  return decklist.flatMap((e) => Array.from({ length: e.qty }, () => ({ name: e.name, info: lookup(e.name) ?? null })))
}

/** Ziehen nach Mulligan-Regel: erster Mulligan gratis, danach je eine Karte unter die Bibliothek. */
export function drawOpeningHand(library: SimCard[], rng: Rng): { hand: SimCard[]; library: SimCard[]; mulligans: number } {
  for (let mulligans = 0; ; mulligans++) {
    const shuffled = shuffle(library, rng)
    const hand = shuffled.slice(0, 7)
    const infos = hand.map((c) => c.info)
    const keep = mulligans === 0 ? evaluateHand(infos).keep : mulligans === 1 ? manaIsFine(infos) : true
    if (keep) {
      // London-Mulligan: ab dem zweiten Mulligan je eine Karte unter die Bibliothek (die schlechteste: zuerst Überzähliges).
      const bottomCount = Math.max(0, mulligans - 1)
      const kept = [...hand]
      const bottomed: SimCard[] = []
      for (let i = 0; i < bottomCount; i++) {
        const idx = pickBottom(kept)
        bottomed.push(...kept.splice(idx, 1))
      }
      return { hand: kept, library: [...shuffled.slice(7), ...bottomed], mulligans }
    }
  }
}

function pickBottom(hand: SimCard[]): number {
  const lands = hand.filter((c) => c.info && isLand(c.info)).length
  // Bei vielen Ländern ein Land, sonst die teuerste Karte.
  if (lands > 4) return hand.findIndex((c) => c.info && isLand(c.info))
  let worst = 0
  hand.forEach((c, i) => {
    if ((c.info?.cmc ?? 99) > (hand[worst].info?.cmc ?? 99)) worst = i
  })
  return worst
}

const isForest = (c: CardInfo) => /\bForest\b/.test(c.typeLine)

interface Pool {
  total: number
  /** Davon grünfähig (für {G}-Symbole). */
  green: number
}

function canPay(pool: Pool, generic: number, green: number): boolean {
  return green <= pool.green && green + generic <= pool.total
}

function pay(pool: Pool, generic: number, green: number): void {
  const colorless = pool.total - pool.green
  const genericFromGreen = Math.max(0, generic - colorless)
  pool.total -= generic + green
  pool.green -= green + genericFromGreen
}

export interface GhaltaState {
  power: number
  casts: number
}

/** Was kostet Ghalta jetzt (generischer Anteil, ohne GG)? */
export const ghaltaGeneric = ({ power, casts }: GhaltaState) => Math.max(0, 10 + 2 * casts - power)

/** Ein Goldfish-Spiel mit gegebener Starthand und Bibliothek. */
export function playOut(hand: SimCard[], library: SimCard[], maxTurns = MAX_TURNS): Omit<GameSim, 'hand' | 'mulligans'> {
  const inHand = [...hand]
  const deck = [...library]
  const board: Permanent[] = []
  const log: TurnLog[] = []

  const forests = () => board.filter((p) => isForest(p.card)).length
  const totalPower = () =>
    board.filter((p) => isCreature(p.card)).reduce((sum, p) => sum + boardPower(p.card, forests()), 0)
  const ferocious = () => board.some((p) => isCreature(p.card) && boardPower(p.card, forests()) >= 4)

  for (let turn = 1; turn <= maxTurns; turn++) {
    for (const p of board) {
      p.sick = false
      p.tapped = false
    }
    const drawn = deck.shift() ?? null
    if (drawn) inHand.push(drawn)

    // Land spielen: am liebsten ungetappter Wald, dann andere ungetappte, zuletzt getappte.
    const lands = inHand.filter((c): c is SimCard & { info: CardInfo } => c.info !== null && isLand(c.info))
    const rank = (c: CardInfo) => (entersTapped(c) ? 2 : manaAbility(c)?.green ? 0 : 1)
    const land = lands.sort((a, b) => rank(a.info) - rank(b.info))[0]
    if (land) {
      inHand.splice(inHand.indexOf(land), 1)
      board.push({ card: land.info, sick: false, tapped: entersTapped(land.info) })
    }

    // Verfügbares Mana.
    const pool: Pool = { total: 0, green: 0 }
    for (const p of board) {
      if (p.tapped || (p.sick && isCreature(p.card))) continue
      const ability = manaAbility(p.card)
      if (!ability) continue
      const amount = ferocious() ? ability.ferociousAmount : ability.amount
      pool.total += amount
      if (ability.green) pool.green += amount
    }
    const manaAtStart = pool.total
    const powerAtStart = totalPower()
    const boardAtStart = board.filter((p) => isCreature(p.card)).map((p) => p.card.name)

    const cast: string[] = []
    let ghaltaNow = false
    const ghalta = (): boolean => {
      const generic = ghaltaGeneric({ power: totalPower(), casts: 0 })
      if (!canPay(pool, generic, 2)) return false
      pay(pool, generic, 2)
      cast.push('Ghalta, Primal Hunger')
      return true
    }

    const castable = () =>
      inHand.filter((c): c is SimCard & { info: CardInfo } => {
        if (!c.info || isLand(c.info)) return false
        const cost = parseCost(c.info.manaCost)
        if (cost.hasX || cost.otherColors > 0) return false
        const ramp = manaAbility(c.info) !== null
        const useful = isCreature(c.info) || (ramp && isArtifact(c.info))
        return useful && canPay(pool, cost.generic, cost.green)
      })

    const play = (c: SimCard & { info: CardInfo }) => {
      const cost = parseCost(c.info.manaCost)
      pay(pool, cost.generic, cost.green)
      inHand.splice(inHand.indexOf(c), 1)
      board.push({ card: c.info, sick: isCreature(c.info), tapped: false })
      cast.push(c.name)
      // Mana-Artefakte (Sol Ring) liefern sofort Mana.
      const ability = manaAbility(c.info)
      if (ability && !isCreature(c.info)) {
        pool.total += ability.amount
        if (ability.green) pool.green += ability.amount
      }
    }

    while (!ghaltaNow) {
      if (ghalta()) {
        ghaltaNow = true
        break
      }
      const options = castable()
      if (options.length === 0) break

      // 1) Gibt es eine Kreatur, die Ghalta noch in diesem Zug möglich macht?
      const enabler = options
        .filter((c) => isCreature(c.info))
        .find((c) => {
          const cost = parseCost(c.info.manaCost)
          const after: Pool = { ...pool }
          if (!canPay(after, cost.generic, cost.green)) return false
          pay(after, cost.generic, cost.green)
          const power = totalPower() + boardPower(c.info, forests())
          return canPay(after, ghaltaGeneric({ power, casts: 0 }), 2)
        })
      if (enabler) {
        play(enabler)
        continue
      }

      // 2) Mana-Beschleuniger zuerst (billigste), 3) dann die stärkste Kreatur.
      const ramp = options.filter((c) => manaAbility(c.info) !== null).sort((a, b) => a.info.cmc - b.info.cmc)
      if (ramp.length > 0) {
        play(ramp[0])
        continue
      }
      const biggest = options.sort(
        (a, b) => boardPower(b.info, forests()) - boardPower(a.info, forests()) || a.info.cmc - b.info.cmc,
      )[0]
      play(biggest)
    }

    log.push({
      turn,
      drew: drawn?.name ?? null,
      land: land?.name ?? null,
      cast,
      powerAtStart,
      boardAtStart,
      power: totalPower(),
      mana: manaAtStart,
      ghalta: ghaltaNow,
    })
    if (ghaltaNow) return { ghaltaTurn: turn, log }
  }
  return { ghaltaTurn: null, log }
}

/** Komplettes Spiel: mischen, Starthand nach Faustregel, durchspielen. */
export function simulateGame(library: SimCard[], seed: number, maxTurns = MAX_TURNS): GameSim {
  const rng = mulberry32(seed)
  const { hand, library: rest, mulligans } = drawOpeningHand(library, rng)
  return { hand, mulligans, ...playOut(hand, rest, maxTurns) }
}

export interface Distribution {
  games: number
  /** Anteil der Spiele je Ghalta-Zug (Index = Zug); letzter Eintrag: nicht bis MAX_TURNS. */
  byTurn: { turn: number; share: number }[]
  never: number
  average: number | null
  /** Anteil der Spiele mit Ghalta bis einschließlich Zug 5. */
  byTurnFive: number
  avgMulligans: number
}

/** Ergebnisse vieler Spiele zusammenfassen (Ghalta-Zug je Spiel, null = nicht geschafft). */
export function summarize(turns: (number | null)[], mulligans: number[], maxTurns = MAX_TURNS): Distribution {
  const games = turns.length
  const cast = turns.filter((t): t is number => t !== null)
  const share = (pred: (t: number) => boolean) => (games ? cast.filter(pred).length / games : 0)
  return {
    games,
    byTurn: Array.from({ length: maxTurns }, (_, i) => ({ turn: i + 1, share: share((t) => t === i + 1) })),
    never: games ? (games - cast.length) / games : 0,
    average: cast.length ? cast.reduce((a, b) => a + b, 0) / cast.length : null,
    byTurnFive: share((t) => t <= 5),
    avgMulligans: games ? mulligans.reduce((a, b) => a + b, 0) / games : 0,
  }
}

/** Seed für Spiel Nummer i einer Serie (damit Serien reproduzierbar sind). */
export const seedFor = (seed: number, i: number) => seed + i * 7919

/** Viele Goldfish-Spiele: Wie schnell kommt Ghalta mit diesem Deck? */
export function simulateMany(library: SimCard[], games: number, seed: number, maxTurns = MAX_TURNS): Distribution {
  const turns: (number | null)[] = []
  const mulligans: number[] = []
  for (let i = 0; i < games; i++) {
    const g = simulateGame(library, seedFor(seed, i), maxTurns)
    turns.push(g.ghaltaTurn)
    mulligans.push(g.mulligans)
  }
  return summarize(turns, mulligans, maxTurns)
}
