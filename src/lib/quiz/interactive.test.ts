import { describe, expect, it } from 'vitest'
import { cardKey, fromScryfall } from '../cards'
import { FIXTURE_CARDS } from '../scryfall.fixture'
import { mulberry32 } from '../sim/rng'
import type { DeckEntry } from '../types'
import { orderQuestions, playable, tapCardQuestions, tapCombatQuestions, tapGhaltaQuestion, TURN_STEPS } from './interactive'
import { fewestFor, orderIsCorrect, selectIsCorrect, selectSolution, type Question, type QuizContext } from './question'

const cards = new Map(FIXTURE_CARDS.map((c) => [cardKey(c.name), fromScryfall(c)]))
const lookup = (name: string) => cards.get(cardKey(name))

const ghaltaDeck: DeckEntry[] = [
  { name: 'Forest', qty: 36 },
  { name: 'Llanowar Elves', qty: 1 },
  { name: 'Elvish Mystic', qty: 1 },
  { name: 'Birds of Paradise', qty: 1 },
  { name: 'Llanowar Tribe', qty: 1 },
  { name: 'Whisperer of the Wilds', qty: 1 },
  { name: 'Sol Ring', qty: 1 },
  { name: 'Commander\'s Sphere', qty: 1 },
  { name: 'Arcane Signet', qty: 1 },
  { name: 'Steel Leaf Champion', qty: 1 },
  { name: 'Pugnacious Hammerskull', qty: 1 },
  { name: 'Gigantosaurus', qty: 1 },
  { name: 'Carnage Tyrant', qty: 1 },
  { name: 'Harmonize', qty: 1 },
  { name: 'Cultivate', qty: 1 },
  { name: 'Counterspell', qty: 1 },
  { name: 'Lightning Bolt', qty: 1 },
]
const ctxFor = (seed: number, decklist = ghaltaDeck): QuizContext => ({
  decklist,
  commander: 'Ghalta, Primal Hunger',
  lookup,
  rulings: () => undefined,
  rng: mulberry32(seed),
})

describe('Select rules', () => {
  it('fewestFor takes the biggest values first', () => {
    expect(fewestFor([1, 5, 3, 6], 10)).toBe(2)
    expect(fewestFor([1, 5, 3, 6], 11)).toBe(2)
    expect(fewestFor([1, 5, 3, 6], 12)).toBe(3)
    expect(fewestFor([1, 2], 10)).toBe(Infinity)
    expect(fewestFor([4], 0)).toBe(0)
  })

  it('exact: all of them and nothing else', () => {
    const rule = { mode: 'exact' as const, correct: [0, 2] }
    expect(selectIsCorrect(rule, [2, 0])).toBe(true)
    expect(selectIsCorrect(rule, [0])).toBe(false)
    expect(selectIsCorrect(rule, [0, 1, 2])).toBe(false)
    expect(selectSolution(rule)).toEqual([0, 2])
  })

  it('fewest: enough power with no extra card; ties count', () => {
    const rule = { mode: 'fewest' as const, values: [5, 5, 3, 6], target: 10 }
    expect(selectIsCorrect(rule, [0, 3])).toBe(true)
    expect(selectIsCorrect(rule, [1, 3])).toBe(true)
    expect(selectIsCorrect(rule, [0, 1])).toBe(true)
    expect(selectIsCorrect(rule, [0, 2])).toBe(false)
    expect(selectIsCorrect(rule, [0, 1, 2])).toBe(false)
    expect(selectIsCorrect(rule, selectSolution(rule))).toBe(true)
  })
})

describe('Order rules', () => {
  it('compares the tapped sequence with the right order or an accepted one', () => {
    const bank = ['b', 'c', 'a']
    expect(orderIsCorrect(['a', 'b', 'c'], bank, [2, 0, 1])).toBe(true)
    expect(orderIsCorrect(['a', 'b', 'c'], bank, [0, 2, 1])).toBe(false)
    expect(orderIsCorrect(['a', 'b', 'c'], bank, [0, 2, 1], [['b', 'a', 'c']])).toBe(true)
    expect(orderIsCorrect(['a', 'b', 'c'], bank, [2, 0])).toBe(false)
  })

  it('playable: one land per turn, rocks tap right away, creatures don’t', () => {
    const forest = { name: 'Forest', kind: 'land' as const, cost: 0, adds: 0 }
    const signet = { name: 'Arcane Signet', kind: 'rock' as const, cost: 2, adds: 1 }
    const elves = { name: 'Llanowar Elves', kind: 'dork' as const, cost: 1, adds: 0 }
    const harmonize = { name: 'Harmonize', kind: 'spell' as const, cost: 4, adds: 0 }
    expect(playable([forest, signet, harmonize], 4)).toBe(true)
    expect(playable([signet, harmonize, forest], 4)).toBe(false)
    expect(playable([forest, elves, harmonize], 4)).toBe(true)
    expect(playable([forest, elves, harmonize], 3)).toBe(false)
    expect(playable([forest, forest], 5)).toBe(false)
  })
})

const checkOrder = (q: Question) => {
  expect(q.kind).toBe('order')
  const order = q.order!
  expect(order.length).toBeGreaterThanOrEqual(3)
  expect([...q.bank!].sort()).toEqual([...order].sort())
  // Never shown already sorted.
  expect(q.bank).not.toEqual(order)
  expect(q.explanation.length).toBeGreaterThan(10)
  const solve = (o: string[]) => o.map((name) => q.bank!.indexOf(name))
  expect(orderIsCorrect(order, q.bank!, solve(order), q.accept)).toBe(true)
  for (const a of q.accept ?? []) expect(orderIsCorrect(order, q.bank!, solve(a), q.accept)).toBe(true)
}

const checkSelect = (q: Question) => {
  expect(q.kind).toBe('select')
  expect(q.cards!.length).toBeGreaterThanOrEqual(4)
  expect(new Set(q.cards!.map((c) => c.name)).size).toBe(q.cards!.length)
  const solution = selectSolution(q.select!)
  expect(solution.length).toBeGreaterThan(0)
  expect(solution.length).toBeLessThan(q.cards!.length)
  expect(selectIsCorrect(q.select!, solution)).toBe(true)
  // Tapping everything is never right.
  expect(selectIsCorrect(q.select!, q.cards!.map((_, i) => i))).toBe(false)
}

describe('Order questions', () => {
  it('all kinds come up and are solvable across many seeds', () => {
    const topics = new Set<string>()
    for (let seed = 1; seed <= 80; seed++) {
      for (const q of orderQuestions(ctxFor(seed))) {
        checkOrder(q)
        topics.add(q.key.split(':')[0])
      }
    }
    expect([...topics].sort()).toEqual(['order-combat', 'order-play', 'order-stack', 'order-turn'])
  })

  it('turn steps keep the real turn order', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const q of orderQuestions(ctxFor(seed)).filter((x) => x.key.startsWith('order-turn:'))) {
        const idx = q.order!.map((s) => TURN_STEPS.indexOf(s))
        expect(idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1]))).toBe(true)
      }
    }
  })

  it('the stack resolves last in, first out', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const q of orderQuestions(ctxFor(seed)).filter((x) => x.key.startsWith('order-stack:'))) {
        const cast = q.key.slice('order-stack:'.length).split('|')
        expect(q.order).toEqual([...cast].reverse())
        expect(new Set(cast).size).toBe(cast.length)
      }
    }
  })

  it('play order: the right order works and most others don’t', () => {
    let found = 0
    for (let seed = 1; seed <= 80; seed++) {
      for (const q of orderQuestions(ctxFor(seed)).filter((x) => x.key.startsWith('order-play:'))) {
        found++
        expect(q.cards!.map((c) => c.name).sort()).toEqual([...q.order!].sort())
        const accepted = 1 + (q.accept?.length ?? 0)
        const total = [...Array(q.order!.length).keys()].reduce((f, i) => f * (i + 1), 1)
        expect(accepted * 3).toBeLessThanOrEqual(total)
      }
    }
    expect(found).toBeGreaterThan(20)
  })
})

describe('Tap questions', () => {
  it('Ghalta: the fewest creatures to get down to GG', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const q = tapGhaltaQuestion(ctxFor(seed), 0)
      expect(q).not.toBeNull()
      checkSelect(q!)
      const rule = q!.select!
      expect(rule.mode).toBe('fewest')
      if (rule.mode === 'fewest') {
        expect([10, 12, 14]).toContain(rule.target)
        // Powers match the captions.
        q!.cards!.forEach((c, i) => expect(c.caption!.startsWith(`${rule.values[i]}/`)).toBe(true))
      }
    }
  })

  it('combat and card-type questions are solvable', () => {
    const topics = new Set<string>()
    for (let seed = 1; seed <= 60; seed++) {
      for (const q of [...tapCombatQuestions(ctxFor(seed)), ...tapCardQuestions(ctxFor(seed))]) {
        checkSelect(q)
        topics.add(q.key.split(':')[0])
      }
    }
    expect([...topics].sort()).toEqual(['tap-blockers', 'tap-lethal', 'tap-type'])
  })

  it('blockers: the right ones survive or kill the attacker', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const q of tapCombatQuestions(ctxFor(seed)).filter((x) => x.key.startsWith('tap-blockers:'))) {
        const [, mode, pt] = q.key.split(':')
        const [p, t] = pt.split('/').map(Number)
        const rule = q.select!
        if (rule.mode !== 'exact') throw new Error('expected exact')
        q.cards!.forEach((c, i) => {
          const card = lookup(c.name)!
          const ok = mode === 's' ? Number(card.toughness) > p : card.power! >= t
          expect(rule.correct.includes(i)).toBe(ok)
        })
      }
    }
  })
})
