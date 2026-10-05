import { isCreature, isLand } from '../cards'
import { createGoldfish, drawOpeningHand, handRuleFor, playOut, type Goldfish, type SimCard, type SimCommander, type TurnLog } from './goldfish'
import { mulberry32 } from './rng'

// Turn scenarios: you play a goldfish game yourself, turn by turn, and see at the end how the
// autopilot did with the very same hand and draws.

/** You get this many turns to cast your commander. */
export const SCENARIO_TURNS = 10

export interface Scenario {
  game: Goldfish
  commander: SimCommander
  mulligans: number
  /** The autopilot's game with the same opening hand and library. */
  autopilot: { commanderTurn: number | null; log: TurnLog[] }
  /** Your finished turns. */
  log: TurnLog[]
  /** The turn in progress. */
  current: TurnLog
  /** Things you could have done better, collected along the way. */
  tips: string[]
}

export function startScenario(library: SimCard[], commander: SimCommander, seed: number): Scenario {
  const { hand, library: rest, mulligans } = drawOpeningHand(library, mulberry32(seed), handRuleFor(commander))
  const autopilot = playOut(hand, rest, commander, SCENARIO_TURNS)
  const game = createGoldfish(hand, rest, commander)
  const scenario: Scenario = { game, commander, mulligans, autopilot, log: [], current: emptyTurn(0), tips: [] }
  beginTurn(scenario)
  return scenario
}

function emptyTurn(turn: number): TurnLog {
  return { turn, drew: null, land: null, cast: [], powerAtStart: 0, boardAtStart: [], sourcesAtStart: [], canCastAtStart: false, power: 0, mana: 0, commander: false }
}

function beginTurn(s: Scenario) {
  const drew = s.game.beginTurn()
  s.current = {
    ...emptyTurn(s.game.turn),
    drew: drew?.name ?? null,
    powerAtStart: s.game.totalPower(),
    boardAtStart: s.game.board.filter((p) => isCreature(p.card)).map((p) => p.card.name),
    mana: s.game.pool.length,
  }
}

/** Why a card in hand can't be played right now (null = it can). */
export function blockedReason(s: Scenario, card: SimCard): string | null {
  if (!card.info) return 'No card data for this card.'
  if (isLand(card.info)) return s.game.landPlayed ? 'You’ve already played a land this turn.' : null
  if (!s.game.isPlayable(card)) return 'This drill only plays creatures and ramp.'
  return s.game.canCast(card) ? null : 'Not enough mana (or the wrong colors).'
}

export function playCard(s: Scenario, card: SimCard): boolean {
  if (card.info && isLand(card.info)) {
    const before = s.game.pool.length
    if (!s.game.playLand(card)) return false
    s.current.land = card.name
    s.current.mana += s.game.pool.length - before
    return true
  }
  if (!s.game.cast(card)) return false
  s.current.cast.push(card.name)
  return true
}

export function castCommander(s: Scenario): boolean {
  if (!s.game.castCommander()) return false
  s.current.cast.push(s.commander.name)
  s.current.commander = true
  finishTurn(s)
  return true
}

/** Notes for this turn: missed land drop, mana left while a creature or ramp was castable. */
function turnTips(s: Scenario): string[] {
  const tips: string[] = []
  const t = s.game.turn
  if (!s.game.landPlayed && s.game.hand.some((c) => c.info && isLand(c.info))) tips.push(`Turn ${t}: you had a land in hand but didn’t play one.`)
  if (s.game.canCastCommander()) tips.push(`Turn ${t}: you could have cast ${s.commander.name} already.`)
  else {
    const left = s.game.hand.find((c) => s.game.canCast(c))
    if (left) tips.push(`Turn ${t}: you could still have cast ${left.name}.`)
  }
  return tips
}

function finishTurn(s: Scenario) {
  s.current.power = s.game.totalPower()
  s.log.push(s.current)
}

/** End the turn; starts the next one unless the scenario is over. */
export function endTurn(s: Scenario) {
  s.tips.push(...turnTips(s))
  finishTurn(s)
  if (!scenarioOver(s)) beginTurn(s)
}

export const scenarioOver = (s: Scenario) => s.game.commanderCast || s.log.length >= SCENARIO_TURNS

export interface ScenarioResult {
  yours: number | null
  autopilot: number | null
  /** 0–5 like a lesson: 5 when you're as fast as the autopilot or faster, minus one per turn slower. */
  score: number
  verdict: string
}

export function scenarioResult(s: Scenario, commanderName: string): ScenarioResult {
  const yours = s.game.commanderCast ? s.log[s.log.length - 1].turn : null
  const auto = s.autopilot.commanderTurn
  const turn = (t: number | null) => t ?? SCENARIO_TURNS + 1
  const behind = turn(yours) - turn(auto)
  const score = yours === null ? 0 : Math.max(0, Math.min(5, 5 - behind))
  const verdict =
    yours === null
      ? auto === null
        ? `Neither of you got ${commanderName} out in ${SCENARIO_TURNS} turns. A tough draw.`
        : `The autopilot cast ${commanderName} on turn ${auto}.`
      : auto === null || behind < 0
        ? `Faster than the autopilot${auto === null ? ', which didn’t make it at all' : ` (turn ${auto})`}!`
        : behind === 0
          ? 'Just as fast as the autopilot.'
          : `The autopilot was ${behind} turn${behind > 1 ? 's' : ''} faster (turn ${auto}).`
  return { yours, autopilot: auto, score, verdict }
}
