import { describe, expect, it } from 'vitest'
import { fromScryfall, type CardInfo } from '../cards'
import { FIXTURE_CARDS } from '../scryfall.fixture'
import { buildLibrary, commanderCostLabel, drawOpeningHand, handRuleFor, playOut, simCommander, simulateGame, simulateMany, type SimCard } from './goldfish'
import { evaluateHand } from './mulligan'
import { mulberry32, shuffle } from './rng'

const info = (name: string): CardInfo => fromScryfall(FIXTURE_CARDS.find((c) => c.name === name)!)
const sim = (...names: string[]): SimCard[] => names.map((name) => ({ name, info: info(name) }))
const times = (n: number, name: string) => Array.from({ length: n }, () => name)
const ghalta = simCommander(info('Ghalta, Primal Hunger'))
const niv = simCommander(info('Niv-Mizzet, Parun'))
const big = { bigCreature: true }

describe('rng', () => {
  it('is reproducible with the same seed', () => {
    expect(shuffle([1, 2, 3, 4, 5, 6], mulberry32(42))).toEqual(shuffle([1, 2, 3, 4, 5, 6], mulberry32(42)))
    expect(shuffle([1, 2, 3, 4, 5, 6], mulberry32(1))).not.toEqual(shuffle([1, 2, 3, 4, 5, 6], mulberry32(2)))
  })
})

describe('evaluateHand (rule of thumb from the study plan)', () => {
  const hand = (...names: string[]) => names.map(info)

  it('keeps 3 lands + mana creature + early big creature', () => {
    const r = evaluateHand(hand('Forest', 'Forest', 'Forest', 'Llanowar Elves', 'Steel Leaf Champion', 'Harmonize', 'Gigantosaurus'), big)
    expect(r).toMatchObject({ lands: 3, ramp: 1, keep: true })
    expect(r.early).toEqual(['Steel Leaf Champion'])
  })

  it('mulligans hands with only one land', () => {
    expect(evaluateHand(hand('Forest', 'Llanowar Elves', 'Elvish Mystic', 'Steel Leaf Champion', 'Harmonize', 'Gigantosaurus', 'Carnage Tyrant'), big).keep).toBe(false)
  })

  it('mulligans hands with too much mana', () => {
    expect(evaluateHand(hand(...times(6, 'Forest'), 'Steel Leaf Champion'), big).keep).toBe(false)
  })

  it('mulligans hands without an early big creature', () => {
    const r = evaluateHand(hand('Forest', 'Forest', 'Forest', 'Llanowar Elves', 'Harmonize', 'Gigantosaurus', 'Carnage Tyrant'), big)
    expect(r.keep).toBe(false)
    expect(r.reasons.join(' ')).toContain('No early big creature')
  })

  it('other decks: keeps working mana plus early plays in the right colors', () => {
    const r = evaluateHand(hand('Island', 'Mountain', 'Spirebluff Canal', 'Arcane Signet', 'Counterspell', 'Guttersnipe', 'Niv-Mizzet, Parun'))
    expect(r).toMatchObject({ lands: 3, ramp: 1, keep: true })
    expect(r.early).toEqual(['Arcane Signet', 'Counterspell', 'Guttersnipe'])
  })

  it('other decks: mulligans lands that can’t cast the spells', () => {
    const r = evaluateHand(hand('Forest', 'Forest', 'Forest', 'Forest', 'Counterspell', 'Guttersnipe', 'Lightning Bolt'))
    expect(r.keep).toBe(false)
    expect(r.reasons.join(' ')).toContain('don’t make the colors')
    expect(evaluateHand(hand('Evolving Wilds', 'Forest', 'Forest', 'Forest', 'Lightning Bolt', 'Harmonize', 'Harmonize')).keep).toBe(true)
  })

  it('picks the rule by commander', () => {
    expect(handRuleFor(ghalta)).toEqual(big)
    expect(handRuleFor(niv)).toEqual({ bigCreature: false })
  })
})

describe('playOut (Goldfish-Autopilot)', () => {
  it('casts Ghalta on turn 4 with elves, Hammerskull and Steel Leaf Champion', () => {
    const hand = sim('Forest', 'Forest', 'Forest', 'Llanowar Elves', 'Steel Leaf Champion', 'Pugnacious Hammerskull', 'Gigantosaurus')
    const result = playOut(hand, sim(...times(10, 'Forest')), ghalta)
    expect(result.commanderTurn).toBe(4)
    expect(result.log[0].cast).toEqual(['Llanowar Elves'])
    expect(result.log[1].cast).toEqual(['Pugnacious Hammerskull'])
    expect(result.log[2].cast).toEqual(['Steel Leaf Champion'])
    expect(result.log[3].cast).toContain('Ghalta, Primal Hunger')
  })

  it('uses Sol Ring right away and mana creatures only a turn later', () => {
    const hand = sim('Forest', 'Sol Ring', 'Llanowar Elves', 'Harmonize', 'Harmonize', 'Harmonize', 'Harmonize')
    const result = playOut(hand, sim(...times(5, 'Forest')), ghalta, 2)
    // Turn 1: Forest → Sol Ring (1) → 2 colorless left, elves need {G}: no longer possible.
    expect(result.log[0].cast).toEqual(['Sol Ring'])
    // Turn 2: 2 Forests + Sol Ring = 4 mana.
    expect(result.log[1].mana).toBe(4)
  })

  it('plays tapped lands only when no other is available', () => {
    const hand = sim('Tranquil Thicket', 'Forest', 'Llanowar Elves', 'Harmonize', 'Harmonize', 'Harmonize', 'Harmonize')
    const result = playOut(hand, sim(...times(5, 'Harmonize')), ghalta, 2)
    expect(result.log[0].land).toBe('Forest')
    expect(result.log[0].cast).toEqual(['Llanowar Elves'])
    expect(result.log[1].land).toBe('Tranquil Thicket')
  })
})

describe('playOut with another commander', () => {
  it('casts Niv-Mizzet only once it has three blue and three red', () => {
    const hand = sim('Island', 'Island', 'Mountain', 'Mountain', 'Arcane Signet', 'Counterspell', 'Lightning Bolt')
    const result = playOut(hand, sim('Island', 'Mountain', 'Mountain', 'Island', 'Island'), niv)
    // Turn 2: Signet. Turn 5: 5 lands + Signet = 6 mana, but only with UUU and RRR.
    expect(result.log[1].cast).toEqual(['Arcane Signet'])
    expect(result.commanderTurn).toBe(5)
    expect(result.log[4].canCastAtStart).toBe(true)
    expect(result.log[4].cast).toEqual(['Niv-Mizzet, Parun'])
  })

  it('waits when the amount is there but the colors aren’t', () => {
    const hand = sim('Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Mountain')
    const result = playOut(hand, sim(...times(6, 'Island')), niv, 8)
    expect(result.log[5].mana).toBe(6)
    expect(result.log[5].canCastAtStart).toBe(false)
    expect(result.commanderTurn).toBeNull()
  })

  it('fetches a land with Evolving Wilds and Cultivate, tapped', () => {
    const hand = sim('Evolving Wilds', 'Forest', 'Forest', 'Cultivate', 'Counterspell', 'Counterspell', 'Counterspell')
    const result = playOut(hand, sim(...times(5, 'Counterspell')), niv, 5)
    // Untapped lands first, Evolving Wilds on turn 3 (its land comes in tapped).
    expect(result.log.map((t) => t.land)).toEqual(['Forest', 'Forest', 'Evolving Wilds', null, null])
    expect(result.log[2].mana).toBe(2)
    expect(result.log[3].cast).toEqual(['Cultivate'])
    // Turn 5: two Forests plus the lands from Evolving Wilds and Cultivate.
    expect(result.log[4].mana).toBe(4)
  })

  it('labels the cost as on the card', () => {
    expect(commanderCostLabel(niv, 0)).toBe('{U}{U}{U}{R}{R}{R}')
    expect(commanderCostLabel(ghalta, 6)).toBe('{4}{G}{G}')
    expect(commanderCostLabel(ghalta, 6, 1)).toBe('{6}{G}{G}')
  })
})

describe('simulation over many games', () => {
  const deck = sim(
    ...times(36, 'Forest'),
    ...times(4, 'Llanowar Elves'),
    ...times(4, 'Elvish Mystic'),
    ...times(3, 'Birds of Paradise'),
    ...times(3, 'Ilysian Caryatid'),
    ...times(3, 'Sol Ring'),
    ...times(8, 'Steel Leaf Champion'),
    ...times(8, 'Pugnacious Hammerskull'),
    ...times(6, 'Dungrove Elder'),
    ...times(6, 'Gigantosaurus'),
    ...times(6, 'Carnage Tyrant'),
    ...times(12, 'Harmonize'),
  )

  it('is reproducible and yields a plausible distribution', () => {
    expect(deck).toHaveLength(99)
    expect(simulateGame(deck, 7, ghalta)).toEqual(simulateGame(deck, 7, ghalta))
    const d = simulateMany(deck, 300, 123, ghalta)
    const total = d.byTurn.reduce((s, b) => s + b.share, 0) + d.never
    expect(total).toBeCloseTo(1)
    expect(d.average).toBeGreaterThan(3)
    expect(d.average).toBeLessThan(9)
    expect(d.byTurnFive).toBeGreaterThan(0.2)
  })

  it('keeps the card count during mulligans', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { hand, library, mulligans } = drawOpeningHand(deck, mulberry32(seed))
      expect(hand.length + library.length).toBe(99)
      expect(hand.length).toBe(7 - Math.max(0, mulligans - 1))
    }
  })

  it('copes with missing card data', () => {
    const library = buildLibrary([{ name: 'Unknown', qty: 60 }, { name: 'Forest', qty: 39 }], (n) => (n === 'Forest' ? info('Forest') : undefined))
    expect(() => simulateGame(library, 1, ghalta)).not.toThrow()
  })
})
