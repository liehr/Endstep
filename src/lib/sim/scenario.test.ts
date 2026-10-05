import { describe, expect, it } from 'vitest'
import { cardKey, fromScryfall, isLand } from '../cards'
import { FIXTURE_CARDS } from '../scryfall.fixture'
import type { DeckEntry } from '../types'
import { autopilotLand, autopilotSpell, buildLibrary, simCommander } from './goldfish'
import { blockedReason, castCommander, endTurn, playCard, SCENARIO_TURNS, scenarioOver, scenarioResult, startScenario, type Scenario } from './scenario'

const cards = new Map(FIXTURE_CARDS.map((c) => [cardKey(c.name), fromScryfall(c)]))
const lookup = (name: string) => cards.get(cardKey(name))
const decklist: DeckEntry[] = [
  { name: 'Forest', qty: 34 },
  { name: 'Tranquil Thicket', qty: 2 },
  { name: 'Llanowar Elves', qty: 6 },
  { name: 'Birds of Paradise', qty: 4 },
  { name: 'Ilysian Caryatid', qty: 4 },
  { name: 'Sol Ring', qty: 2 },
  { name: 'Cultivate', qty: 3 },
  { name: 'Steel Leaf Champion', qty: 8 },
  { name: 'Pugnacious Hammerskull', qty: 8 },
  { name: 'Dungrove Elder', qty: 5 },
  { name: 'Gigantosaurus', qty: 6 },
  { name: 'Carnage Tyrant', qty: 6 },
  { name: 'Harmonize', qty: 11 },
]
const library = buildLibrary(decklist, lookup)
const ghalta = simCommander(lookup('Ghalta, Primal Hunger')!)

/** Play the scenario exactly like the autopilot would. */
function playLikeAutopilot(s: Scenario) {
  while (!scenarioOver(s)) {
    const land = autopilotLand(s.game)
    if (land) playCard(s, land)
    for (;;) {
      if (castCommander(s)) break
      const next = autopilotSpell(s.game, ghalta)
      if (!next) break
      playCard(s, next)
    }
    if (!scenarioOver(s)) endTurn(s)
  }
}

describe('Turn scenarios', () => {
  it('playing like the autopilot gets the same result, with no tips', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = startScenario(library, ghalta, seed)
      playLikeAutopilot(s)
      const r = scenarioResult(s, 'Ghalta')
      expect(r.yours).toBe(r.autopilot)
      expect(s.log.map((t) => t.cast)).toEqual(s.autopilot.log.map((t) => t.cast))
      expect(s.log.map((t) => t.mana)).toEqual(s.autopilot.log.map((t) => t.mana))
      expect(r.score).toBe(r.yours === null ? 0 : 5)
      expect(s.tips).toEqual([])
    }
  })

  it('doing nothing ends after the turn limit with tips and no points', () => {
    const s = startScenario(library, ghalta, 7)
    while (!scenarioOver(s)) endTurn(s)
    expect(s.log).toHaveLength(SCENARIO_TURNS)
    expect(scenarioResult(s, 'Ghalta').score).toBe(0)
    expect(s.tips.some((t) => t.includes('land'))).toBe(true)
  })

  it('only one land per turn, and says why a card can’t be played', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = startScenario(library, ghalta, seed)
      const lands = s.game.hand.filter((c) => c.info && isLand(c.info))
      if (lands.length < 2) continue
      expect(blockedReason(s, lands[0])).toBeNull()
      expect(playCard(s, lands[0])).toBe(true)
      expect(blockedReason(s, lands[1])).toMatch(/already played a land/)
      expect(playCard(s, lands[1])).toBe(false)
      const harmonize = s.game.hand.find((c) => c.name === 'Harmonize')
      if (harmonize) expect(blockedReason(s, harmonize)).toMatch(/only plays creatures and ramp/)
    }
  })

  it('one turn slower costs one point', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = startScenario(library, ghalta, seed)
      if (s.autopilot.commanderTurn === null || s.autopilot.commanderTurn > SCENARIO_TURNS - 1) continue
      // Skip turn 1 completely, then play like the autopilot.
      endTurn(s)
      playLikeAutopilot(s)
      const r = scenarioResult(s, 'Ghalta')
      if (r.yours !== null) expect(r.score).toBe(Math.max(0, 5 - Math.max(0, r.yours - r.autopilot!)))
    }
  })
})
