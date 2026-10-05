import { describe, expect, it } from 'vitest'
import { fromScryfall, type CardInfo } from '../cards'
import { FIXTURE_CARDS } from '../scryfall.fixture'
import { buildLibrary, drawOpeningHand, playOut, simulateGame, simulateMany, type SimCard } from './goldfish'
import { evaluateHand } from './mulligan'
import { mulberry32, shuffle } from './rng'

const info = (name: string): CardInfo => fromScryfall(FIXTURE_CARDS.find((c) => c.name === name)!)
const sim = (...names: string[]): SimCard[] => names.map((name) => ({ name, info: info(name) }))
const times = (n: number, name: string) => Array.from({ length: n }, () => name)

describe('rng', () => {
  it('ist mit gleichem Seed reproduzierbar', () => {
    expect(shuffle([1, 2, 3, 4, 5, 6], mulberry32(42))).toEqual(shuffle([1, 2, 3, 4, 5, 6], mulberry32(42)))
    expect(shuffle([1, 2, 3, 4, 5, 6], mulberry32(1))).not.toEqual(shuffle([1, 2, 3, 4, 5, 6], mulberry32(2)))
  })
})

describe('evaluateHand (Faustregel aus dem Lernplan)', () => {
  const hand = (...names: string[]) => names.map(info)

  it('behält 3 Länder + Manakreatur + frühe dicke Kreatur', () => {
    const r = evaluateHand(hand('Forest', 'Forest', 'Forest', 'Llanowar Elves', 'Steel Leaf Champion', 'Harmonize', 'Gigantosaurus'))
    expect(r).toMatchObject({ lands: 3, ramp: 1, keep: true })
    expect(r.earlyBig).toEqual(['Steel Leaf Champion'])
  })

  it('schickt Hände mit nur einem Land zurück', () => {
    expect(evaluateHand(hand('Forest', 'Llanowar Elves', 'Elvish Mystic', 'Steel Leaf Champion', 'Harmonize', 'Gigantosaurus', 'Carnage Tyrant')).keep).toBe(false)
  })

  it('schickt Hände mit zu viel Mana zurück', () => {
    expect(evaluateHand(hand(...times(6, 'Forest'), 'Steel Leaf Champion')).keep).toBe(false)
  })

  it('schickt Hände ohne frühe dicke Kreatur zurück', () => {
    const r = evaluateHand(hand('Forest', 'Forest', 'Forest', 'Llanowar Elves', 'Harmonize', 'Gigantosaurus', 'Carnage Tyrant'))
    expect(r.keep).toBe(false)
    expect(r.reasons.join(' ')).toContain('Keine frühe dicke Kreatur')
  })
})

describe('playOut (Goldfish-Autopilot)', () => {
  it('castet Ghalta in Zug 4 mit Elfen, Hammerskull und Steel Leaf Champion', () => {
    const hand = sim('Forest', 'Forest', 'Forest', 'Llanowar Elves', 'Steel Leaf Champion', 'Pugnacious Hammerskull', 'Gigantosaurus')
    const result = playOut(hand, sim(...times(10, 'Forest')))
    expect(result.ghaltaTurn).toBe(4)
    expect(result.log[0].cast).toEqual(['Llanowar Elves'])
    expect(result.log[1].cast).toEqual(['Pugnacious Hammerskull'])
    expect(result.log[2].cast).toEqual(['Steel Leaf Champion'])
    expect(result.log[3].cast).toContain('Ghalta, Primal Hunger')
  })

  it('nutzt Sol Ring sofort und Manakreaturen erst einen Zug später', () => {
    const hand = sim('Forest', 'Sol Ring', 'Llanowar Elves', 'Harmonize', 'Harmonize', 'Harmonize', 'Harmonize')
    const result = playOut(hand, sim(...times(5, 'Forest')), 2)
    // Zug 1: Wald → Sol Ring (1) → 2 farblos übrig, Elfen brauchen {G}: geht nicht mehr.
    expect(result.log[0].cast).toEqual(['Sol Ring'])
    // Zug 2: 2 Wälder + Sol Ring = 4 Mana.
    expect(result.log[1].mana).toBe(4)
  })

  it('spielt getappte Länder nur, wenn kein anderes da ist', () => {
    const hand = sim('Tranquil Thicket', 'Forest', 'Llanowar Elves', 'Harmonize', 'Harmonize', 'Harmonize', 'Harmonize')
    const result = playOut(hand, sim(...times(5, 'Harmonize')), 2)
    expect(result.log[0].land).toBe('Forest')
    expect(result.log[0].cast).toEqual(['Llanowar Elves'])
    expect(result.log[1].land).toBe('Tranquil Thicket')
  })
})

describe('Simulation über viele Spiele', () => {
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

  it('ist reproduzierbar und liefert eine plausible Verteilung', () => {
    expect(deck).toHaveLength(99)
    expect(simulateGame(deck, 7)).toEqual(simulateGame(deck, 7))
    const d = simulateMany(deck, 300, 123)
    const total = d.byTurn.reduce((s, b) => s + b.share, 0) + d.never
    expect(total).toBeCloseTo(1)
    expect(d.average).toBeGreaterThan(3)
    expect(d.average).toBeLessThan(9)
    expect(d.byTurnFive).toBeGreaterThan(0.2)
  })

  it('hält beim Mulligan die Kartenzahl ein', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { hand, library, mulligans } = drawOpeningHand(deck, mulberry32(seed))
      expect(hand.length + library.length).toBe(99)
      expect(hand.length).toBe(7 - Math.max(0, mulligans - 1))
    }
  })

  it('kommt mit fehlenden Kartendaten zurecht', () => {
    const library = buildLibrary([{ name: 'Unbekannt', qty: 60 }, { name: 'Forest', qty: 39 }], (n) => (n === 'Forest' ? info('Forest') : undefined))
    expect(() => simulateGame(library, 1)).not.toThrow()
  })
})
