import { describe, expect, it } from 'vitest'
import { cardKey, fromScryfall } from '../cards'
import { ghaltaCost } from '../ghalta'
import { FIXTURE_CARDS } from '../scryfall.fixture'
import { mulberry32 } from '../sim/rng'
import type { DeckEntry } from '../types'
import { challengeBest, challengeQuestion, costSymbols } from './challenge'

const cards = new Map(FIXTURE_CARDS.map((c) => [cardKey(c.name), fromScryfall(c)]))
const lookup = (name: string) => cards.get(cardKey(name))
const decklist: DeckEntry[] = ['Llanowar Elves', 'Steel Leaf Champion', 'Pugnacious Hammerskull', 'Gigantosaurus', 'Carnage Tyrant', 'Llanowar Tribe', 'Ghalta, Primal Hunger'].map((name) => ({
  name,
  qty: 1,
}))

const powerOf = (label: string) => Number(label.match(/(\d+)\/\d+$/)![1])
const castsOf = (prompt: string) => (prompt.startsWith('Not cast') ? 0 : prompt.startsWith('Cast once') ? 1 : Number(prompt.match(/Cast (\d) times/)![1]))

describe('Ghalta challenge', () => {
  const cases: [string, { decklist: DeckEntry[]; lookup: typeof lookup }][] = [
    ['deck creatures', { decklist, lookup }],
    ['made-up creatures', { decklist: [], lookup }],
  ]
  for (const [label, ctx] of cases) {
    it(`answers are right across many seeds (${label})`, () => {
      const rng = mulberry32(42)
      for (let i = 0; i < 500; i++) {
        const q = challengeQuestion(ctx, rng)
        expect(q.options).toHaveLength(4)
        expect(new Set(q.options).size).toBe(4)
        expect(q.options).toContain(q.correct)
        expect(q.board.some((b) => b.startsWith('Ghalta'))).toBe(false)
        const cost = ghaltaCost(q.board.map(powerOf).reduce((s, p) => s + p, 0), castsOf(q.prompt))
        expect(q.correct).toBe(q.prompt.includes('more power') ? String(cost.missingPowerForGG) : costSymbols(cost.generic))
      }
    })
  }

  it('remembers the best run', () => {
    expect(challengeBest([])).toBe(0)
    expect(challengeBest([{ lessonId: 'challenge', correct: 7 }, { lessonId: 'rules', correct: 9 }, { lessonId: 'challenge', correct: 12 }])).toBe(12)
  })
})
