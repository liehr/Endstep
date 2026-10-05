import {
  boardPower,
  entersTapped,
  fetchesLand,
  isCreature,
  isLand,
  manaAbility,
  parseCost,
  rampsLand,
  type CardInfo,
  type ManaAbility,
  type ManaCost,
} from '../cards'
import { ANY, bits, payFrom } from '../mana'
import type { DeckEntry } from '../types'
import { DEFAULT_RULE, evaluateHand, manaIsFine, type HandRule } from './mulligan'
import { mulberry32, shuffle, type Rng } from './rng'

// "Goldfishing": play the deck alone, without opponents. A simple autopilot plays lands,
// ramp and the biggest affordable creatures and casts the commander as soon as possible.
// Deliberately simple – it's about a feel for the deck's speed.

/** A card in the simulation. info = null if the card data is (still) missing. */
export interface SimCard {
  name: string
  info: CardInfo | null
}

interface Permanent {
  card: CardInfo
  /** Creatures can only tap from the next turn on. */
  sick: boolean
  /** Entered tapped (e.g. Tranquil Thicket). */
  tapped: boolean
  /** Mana it makes; fetched basic lands make any color. */
  mana: ManaAbility | null
}

/** The commander as the simulation sees it. */
export interface SimCommander {
  name: string
  cost: ManaCost
  /** "Costs {X} less, where X is the total power of creatures you control" (Ghalta). */
  reducedByPower: boolean
}

export function simCommander(card: CardInfo): SimCommander {
  return {
    name: card.name,
    cost: parseCost(card.manaCost),
    reducedByPower: /costs \{X\} less to cast, where X is the total power of creatures you control/i.test(card.oracleText),
  }
}

/** Mulligan rule that fits the commander: big-creature decks want an early big creature. */
export const handRuleFor = (commander: SimCommander | null): HandRule =>
  commander?.reducedByPower ? { bigCreature: true } : DEFAULT_RULE

/** Generic part of the commander's cost right now (tax +2 per earlier cast, Ghalta's reduction). */
export function commanderGeneric(commander: SimCommander, power: number, casts = 0): number {
  return Math.max(0, commander.cost.generic + 2 * casts - (commander.reducedByPower ? power : 0))
}

/** Cost as on the card, e.g. "{4}{G}{G}" for Ghalta with 6 power. */
export function commanderCostLabel(commander: SimCommander, power: number, casts = 0): string {
  const generic = commanderGeneric(commander, power, casts)
  const pips = commander.cost.pips.map((p) => `{${['W', 'U', 'B', 'R', 'G'].filter((_, i) => p & (1 << i)).join('/') || 'C'}}`)
  return `${generic > 0 || pips.length === 0 ? `{${generic}}` : ''}${pips.join('')}`
}

export interface TurnLog {
  turn: number
  drew: string | null
  land: string | null
  cast: string[]
  /** Total power at the start of the turn (before casting). */
  powerAtStart: number
  /** Creatures on the battlefield at the start of the turn. */
  boardAtStart: string[]
  /** Untapped mana sources at the start of the main phase. */
  sourcesAtStart: string[]
  /** Could the commander be cast right at the start of the main phase (amount and colors)? */
  canCastAtStart: boolean
  /** Total power at the end of the turn. */
  power: number
  /** Available mana at the start of the main phase. */
  mana: number
  /** The commander was cast this turn. */
  commander: boolean
}

export interface GameSim {
  hand: SimCard[]
  mulligans: number
  /** Turn in which the commander was cast; null if not by the limit. */
  commanderTurn: number | null
  log: TurnLog[]
}

export const MAX_TURNS = 12

export function buildLibrary(decklist: DeckEntry[], lookup: (name: string) => CardInfo | undefined): SimCard[] {
  return decklist.flatMap((e) => Array.from({ length: e.qty }, () => ({ name: e.name, info: lookup(e.name) ?? null })))
}

/** Draw by the mulligan rule: first mulligan free, then one card to the bottom of the library each. */
export function drawOpeningHand(
  library: SimCard[],
  rng: Rng,
  rule: HandRule = DEFAULT_RULE,
): { hand: SimCard[]; library: SimCard[]; mulligans: number } {
  for (let mulligans = 0; ; mulligans++) {
    const shuffled = shuffle(library, rng)
    const hand = shuffled.slice(0, 7)
    const infos = hand.map((c) => c.info)
    const keep = mulligans === 0 ? evaluateHand(infos, rule).keep : mulligans === 1 ? manaIsFine(infos) : true
    if (keep) {
      // London mulligan: from the second mulligan on, one card each to the bottom (the worst one: surplus first).
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
  // With many lands a land, otherwise the most expensive card.
  if (lands > 4) return hand.findIndex((c) => c.info && isLand(c.info))
  let worst = 0
  hand.forEach((c, i) => {
    if ((c.info?.cmc ?? 99) > (hand[worst].info?.cmc ?? 99)) worst = i
  })
  return worst
}

const isForest = (c: CardInfo) => /\bForest\b/.test(c.typeLine)

/** A basic land fetched by Evolving Wilds or Cultivate: taps for any color. */
const FETCHED: ManaAbility = { amount: 1, ferociousAmount: 1, mask: ANY }
const fetchedLand = (from: string): CardInfo => ({
  name: `Basic land (${from})`,
  typeLine: 'Basic Land',
  manaCost: '',
  cmc: 0,
  power: null,
  powerText: null,
  toughness: null,
  oracleText: '',
  producedMana: [],
  keywords: [],
  image: null,
  imageLarge: null,
  art: null,
  scryfallUri: '',
  set: '',
  setName: '',
  collectorNumber: '',
})

/** One goldfish game with a given opening hand, library and commander. */
export function playOut(
  hand: SimCard[],
  library: SimCard[],
  commander: SimCommander,
  maxTurns = MAX_TURNS,
): Omit<GameSim, 'hand' | 'mulligans'> {
  const inHand = [...hand]
  const deck = [...library]
  const board: Permanent[] = []
  const log: TurnLog[] = []

  const forests = () => board.filter((p) => isForest(p.card)).length
  const totalPower = () =>
    board.filter((p) => isCreature(p.card)).reduce((sum, p) => sum + boardPower(p.card, forests()), 0)
  const ferocious = () => board.some((p) => isCreature(p.card) && boardPower(p.card, forests()) >= 4)
  const colorsOnBoard = () => board.reduce((m, p) => m | (p.mana?.mask ?? 0), 0)

  for (let turn = 1; turn <= maxTurns; turn++) {
    for (const p of board) {
      p.sick = false
      p.tapped = false
    }
    const drawn = deck.shift() ?? null
    if (drawn) inHand.push(drawn)

    // Play a land: untapped ones first, preferring new colors; fetch lands, then tapped ones last.
    const lands = inHand.filter((c): c is SimCard & { info: CardInfo } => c.info !== null && isLand(c.info))
    const have = colorsOnBoard()
    const rank = (c: CardInfo) => {
      const ability = manaAbility(c)
      if (!ability) return fetchesLand(c) ? 15 : 30
      return (entersTapped(c) ? 20 : 0) - bits(ability.mask & ~have)
    }
    const land = lands.sort((a, b) => rank(a.info) - rank(b.info))[0]
    if (land) {
      inHand.splice(inHand.indexOf(land), 1)
      if (fetchesLand(land.info)) board.push({ card: fetchedLand(land.name), sick: false, tapped: true, mana: FETCHED })
      else board.push({ card: land.info, sick: false, tapped: entersTapped(land.info), mana: manaAbility(land.info) })
    }

    // Available mana: one unit per mana, each with the colors it can be.
    let pool: number[] = []
    const sources: string[] = []
    for (const p of board) {
      if (p.tapped || (p.sick && isCreature(p.card)) || !p.mana) continue
      const amount = ferocious() ? p.mana.ferociousAmount : p.mana.amount
      pool.push(...Array.from({ length: amount }, () => p.mana!.mask))
      sources.push(p.card.name)
    }
    const manaAtStart = pool.length
    const powerAtStart = totalPower()
    const boardAtStart = board.filter((p) => isCreature(p.card)).map((p) => p.card.name)
    const tryPay = (generic: number, pips: number[], from = pool) => payFrom(from, generic, pips)
    const canCastAtStart = tryPay(commanderGeneric(commander, powerAtStart), commander.cost.pips) !== null

    const cast: string[] = []
    let commanderNow = false
    const castCommander = (): boolean => {
      const left = tryPay(commanderGeneric(commander, totalPower()), commander.cost.pips)
      if (!left) return false
      pool = left
      cast.push(commander.name)
      return true
    }

    const castable = () =>
      inHand.filter((c): c is SimCard & { info: CardInfo } => {
        if (!c.info || isLand(c.info)) return false
        const cost = parseCost(c.info.manaCost)
        if (cost.hasX) return false
        const useful = isCreature(c.info) || manaAbility(c.info) !== null || rampsLand(c.info) !== null
        return useful && tryPay(cost.generic, cost.pips) !== null
      })

    const play = (c: SimCard & { info: CardInfo }) => {
      const cost = parseCost(c.info.manaCost)
      pool = tryPay(cost.generic, cost.pips) ?? pool
      inHand.splice(inHand.indexOf(c), 1)
      cast.push(c.name)
      const ability = manaAbility(c.info)
      const permanent = isCreature(c.info) || ability !== null
      if (permanent) board.push({ card: c.info, sick: isCreature(c.info), tapped: false, mana: ability })
      // Mana rocks (Sol Ring) produce mana right away.
      if (ability && !isCreature(c.info)) pool.push(...Array.from({ length: ability.amount }, () => ability.mask))
      const fetched = rampsLand(c.info)
      if (fetched) {
        board.push({ card: fetchedLand(c.name), sick: false, tapped: fetched.tapped, mana: FETCHED })
        if (!fetched.tapped) pool.push(ANY)
      }
    }

    while (!commanderNow) {
      if (castCommander()) {
        commanderNow = true
        break
      }
      const options = castable()
      if (options.length === 0) break

      // 1) Is there a creature that still enables the commander this turn (Ghalta's reduction)?
      const enabler = commander.reducedByPower
        ? options
            .filter((c) => isCreature(c.info))
            .find((c) => {
              const cost = parseCost(c.info.manaCost)
              const after = tryPay(cost.generic, cost.pips)
              if (!after) return false
              const power = totalPower() + boardPower(c.info, forests())
              return tryPay(commanderGeneric(commander, power), commander.cost.pips, after) !== null
            })
        : undefined
      if (enabler) {
        play(enabler)
        continue
      }

      // 2) Ramp first (cheapest), 3) then the biggest creature.
      const ramp = options
        .filter((c) => manaAbility(c.info) !== null || rampsLand(c.info) !== null)
        .sort((a, b) => a.info.cmc - b.info.cmc)
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
      sourcesAtStart: sources,
      canCastAtStart,
      power: totalPower(),
      mana: manaAtStart,
      commander: commanderNow,
    })
    if (commanderNow) return { commanderTurn: turn, log }
  }
  return { commanderTurn: null, log }
}

/** Full game: shuffle, opening hand by rule of thumb, play it out. */
export function simulateGame(library: SimCard[], seed: number, commander: SimCommander, maxTurns = MAX_TURNS): GameSim {
  const rng = mulberry32(seed)
  const { hand, library: rest, mulligans } = drawOpeningHand(library, rng, handRuleFor(commander))
  return { hand, mulligans, ...playOut(hand, rest, commander, maxTurns) }
}

export interface Distribution {
  games: number
  /** Share of games per commander turn (index = turn); last entry: not by MAX_TURNS. */
  byTurn: { turn: number; share: number }[]
  never: number
  average: number | null
  /** Share of games with the commander by turn 5 inclusive. */
  byTurnFive: number
  avgMulligans: number
}

/** Summarize the results of many games (commander turn per game, null = didn't make it). */
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

/** Seed for game number i of a series (so series are reproducible). */
export const seedFor = (seed: number, i: number) => seed + i * 7919

/** Many goldfish games: how fast does the commander land with this deck? */
export function simulateMany(library: SimCard[], games: number, seed: number, commander: SimCommander, maxTurns = MAX_TURNS): Distribution {
  const turns: (number | null)[] = []
  const mulligans: number[] = []
  for (let i = 0; i < games; i++) {
    const g = simulateGame(library, seedFor(seed, i), commander, maxTurns)
    turns.push(g.commanderTurn)
    mulligans.push(g.mulligans)
  }
  return summarize(turns, mulligans, maxTurns)
}
