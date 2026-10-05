import { describe, expect, it } from 'vitest'
import { cardKey, fromScryfall } from '../cards'
import { FIXTURE_CARDS } from '../scryfall.fixture'
import { mulberry32 } from '../sim/rng'
import type { DeckEntry } from '../types'
import { ghaltaMathQuestions } from './ghaltaMath'
import type { Question, QuizContext } from './question'

const cards = new Map(FIXTURE_CARDS.map((c) => [cardKey(c.name), fromScryfall(c)]))
const lookup = (name: string) => cards.get(cardKey(name))

const decklist: DeckEntry[] = [
  { name: 'Forest', qty: 36 },
  { name: 'Llanowar Elves', qty: 6 },
  { name: 'Birds of Paradise', qty: 4 },
  { name: 'Ilysian Caryatid', qty: 4 },
  { name: 'Whisperer of the Wilds', qty: 2 },
  { name: 'Llanowar Tribe', qty: 2 },
  { name: 'Sol Ring', qty: 2 },
  { name: 'Steel Leaf Champion', qty: 8 },
  { name: 'Pugnacious Hammerskull', qty: 8 },
  { name: 'Dungrove Elder', qty: 5 },
  { name: 'Gigantosaurus', qty: 6 },
  { name: 'Carnage Tyrant', qty: 6 },
  { name: 'Ghalta, Primal Hunger', qty: 1 },
]
const ctxFor = (seed: number, list = decklist): QuizContext => ({ rng: mulberry32(seed), decklist: list, commander: 'Ghalta, Primal Hunger', lookup })

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const topic = (q: Question) => q.key.split(':')[0]
const correctLabel = (q: Question) => q.options.find((o) => o.id === q.correct)!.label
const generic = (power: number, casts: number) => Math.max(0, 10 + 2 * casts - power)
const label = (power: number, casts: number) => (generic(power, casts) ? `${generic(power, casts)}GG` : 'GG')
const powerOf = (name: string) => (/^a \d+\/\d+ creature$/.test(name) ? Number(name.match(/^a (\d+)/)![1]) : lookup(name)!.power!)

function castsOf(q: Question): number {
  const m = (q.context ?? '').match(/cast from the command zone (once|(\d+) times) before/)
  return m ? (m[2] ? Number(m[2]) : 1) : 0
}

/** Powers of your creatures: from the cards, or from the “On your battlefield” sentence. */
function boardOf(q: Question): number[] {
  if (q.cards) return q.cards.map((c) => lookup(c.name)!.power!)
  const m = (q.context ?? '').match(/On your battlefield: ([^.]*)\./)
  return m ? [...m[1].matchAll(/(\d+)\/\d+/g)].map((x) => Number(x[1])) : []
}
const boardPower = (q: Question) => boardOf(q).reduce((s, p) => s + p, 0)

function handOf(text: string): { cmc: number; power: number } {
  const cmc = Number(text.match(/\((\d+) mana/)![1])
  return { cmc, power: powerOf(text.split(' (')[0]) }
}
const handInContext = (q: Question) => handOf(q.context!.match(/In your hand: (.+)\.$/)![1])
const num = (q: Question, re: RegExp) => Number((q.prompt + ' ' + (q.context ?? '')).match(re)![1])

const COUNTS_FALSE = /opponent’s \d|in your hand|graveyard|isn’t crewed|an opponent gained control|0\/4|Ghalta’s own/

// Recomputes the right answer from what the question shows.
const CHECKS: Record<string, (q: Question) => void> = {
  'ghalta-fits': (q) => {
    const total = generic(boardPower(q), castsOf(q)) + 2
    expect(correctLabel(q)).toBe(num(q, /You have (\d+) mana/) >= total ? 'Yes' : 'No')
  },
  'ghalta-first': (q) => {
    const mana = num(q, /You have (\d+) mana/)
    const power = boardPower(q)
    const casts = castsOf(q)
    for (const o of q.options) {
      const fits = o.label.startsWith('None')
        ? generic(power, casts) + 2 <= mana
        : handOf(o.label).cmc + generic(power + handOf(o.label).power, casts) + 2 <= mana
      expect(fits).toBe(o.id === q.correct)
    }
  },
  'ghalta-reverse': (q) => {
    expect(correctLabel(q)).toBe(String(10 + 2 * castsOf(q) - num(q, /(\d+)GG/)))
  },
  'ghalta-tax-story': (q) => {
    const cz = (q.context!.match(/cast Ghalta from the command zone/g) ?? []).length
    expect(cz).toBeGreaterThan(0)
    if (/tax/.test(q.prompt)) expect(correctLabel(q)).toBe(`+${2 * cz}`)
    else expect(correctLabel(q)).toBe(label(num(q, /You control (\d+) total power/), cz))
  },
  'ghalta-savings': (q) => {
    expect(correctLabel(q)).toBe(String(Math.min(boardPower(q), 10 + 2 * castsOf(q))))
  },
  'ghalta-cheapest': (q) => {
    const gens = q.options.map((o) => ({
      id: o.id,
      g: generic(
        o.label.split(' + ').reduce((s, part) => s + (/^\d+\/\d+$/.test(part) ? Number(part.split('/')[0]) : powerOf(part)), 0),
        castsOf(q),
      ),
    }))
    const best = gens.find((x) => x.id === q.correct)!.g
    for (const x of gens) if (x.id !== q.correct) expect(x.g).toBeGreaterThan(best)
  },
  'ghalta-missing': (q) => {
    expect(correctLabel(q)).toBe(String(generic(boardPower(q), castsOf(q))))
  },
  'ghalta-response': (q) => {
    const victim = q.context!.match(/an opponent (?:destroys|exiles|returns) (.+?)(?: to your hand)?\.$/)![1]
    const vp = victim.startsWith('your ') ? Number(victim.match(/your (\d+)\//)![1]) : powerOf(victim)
    const power = boardPower(q)
    if (/What happens/.test(q.prompt)) expect(correctLabel(q)).toBe('It resolves as normal')
    else if (/main phase/.test(q.prompt)) {
      expect(q.context).not.toMatch(/to your hand/)
      expect(correctLabel(q)).toBe(label(power - vp, castsOf(q)))
    } else expect(correctLabel(q)).toBe(label(power, castsOf(q)))
  },
  'ghalta-boost': (q) => {
    const c = q.context!
    let bonus: number
    if (/each creature you control \+1\/\+1/.test(c)) bonus = boardOf(q).length
    else if (/has \d+ \+1\/\+1 counter/.test(c)) bonus = Number(c.match(/has (\d+) \+1\/\+1 counter/)![1])
    else if (/create \d+ 1\/1/.test(c)) bonus = Number(c.match(/create (\d+) 1\/1/)![1])
    else if (/create a \d+\/\d+ creature token/.test(c)) bonus = Number(c.match(/create a (\d+)\//)![1])
    else bonus = Number(c.match(/\+(\d+)\/\+\d+ until end of turn/)![1])
    expect(correctLabel(q)).toBe(label(boardPower(q) + bonus, castsOf(q)))
  },
  'ghalta-counts': (q) => {
    const lowers = !/NOT/.test(q.prompt)
    for (const o of q.options) expect(!COUNTS_FALSE.test(o.label)).toBe(o.id === q.correct ? lowers : !lowers)
  },
  'ghalta-turn-mana': (q) => {
    const h = handInContext(q)
    expect(correctLabel(q)).toBe(String(h.cmc + generic(boardPower(q) + h.power, castsOf(q)) + 2))
  },
  'ghalta-order': (q) => {
    const h = handInContext(q)
    const casts = castsOf(q)
    expect(correctLabel(q)).toBe(String(generic(boardPower(q), casts) - generic(boardPower(q) + h.power, casts)))
  },
  'ghalta-gg-casts': (q) => {
    const power = q.cards ? boardPower(q) : num(q, /have (\d+) total power/)
    const answer = Number(correctLabel(q))
    expect(generic(power, answer)).toBe(0)
    expect(generic(power, answer + 1)).toBeGreaterThan(0)
  },
  'ghalta-mana-left': (q) => {
    expect(correctLabel(q)).toBe(String(num(q, /You have (\d+) mana/) - generic(boardPower(q), castsOf(q)) - 2))
  },
  'ghalta-opponents': (q) => {
    expect(correctLabel(q)).toBe(label(boardPower(q), castsOf(q)))
  },
}

const checkShape = (q: Question) => {
  expect(q.prompt.length).toBeGreaterThan(5)
  expect(q.explanation.length).toBeGreaterThan(10)
  expect(q.key.startsWith(`${topic(q)}:`)).toBe(true)
  expect(q.id.startsWith(`${topic(q)}-`)).toBe(true)
  expect(q.options.length).toBeGreaterThanOrEqual(2)
  expect(q.options.length).toBeLessThanOrEqual(4)
  expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length)
  expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length)
  expect(q.options.some((o) => o.id === q.correct)).toBe(true)
}

describe('Ghalta Math questions', () => {
  it('have the right shape, unique ids and many topics', () => {
    for (const seed of SEEDS) {
      const qs = ghaltaMathQuestions(ctxFor(seed))
      expect(qs.length).toBeGreaterThanOrEqual(25)
      expect(qs.length).toBeLessThanOrEqual(40)
      qs.forEach(checkShape)
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length)
      expect(new Set(qs.map(topic)).size).toBeGreaterThanOrEqual(8)
    }
  })

  it('have correct answers for every topic', () => {
    const seen = new Set<string>()
    for (const seed of SEEDS) {
      for (const q of ghaltaMathQuestions(ctxFor(seed))) {
        const check = CHECKS[topic(q)]
        expect(check, topic(q)).toBeDefined()
        check(q)
        seen.add(topic(q))
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(CHECKS).sort())
  })

  it('use creatures from the deck, never Ghalta or non-creatures', () => {
    const names = new Set<string>()
    for (const seed of SEEDS.slice(0, 50)) for (const q of ghaltaMathQuestions(ctxFor(seed))) q.cards?.forEach((c) => names.add(c.name))
    expect(names.has('Steel Leaf Champion')).toBe(true)
    expect(names.has('Ghalta, Primal Hunger')).toBe(false)
    expect(names.has('Sol Ring')).toBe(false)
    expect(names.has('Dungrove Elder')).toBe(false)
  })

  it('vary a lot across lessons', () => {
    const keys = new Set<string>()
    for (const seed of SEEDS.slice(0, 20)) for (const q of ghaltaMathQuestions(ctxFor(seed))) keys.add(q.key)
    expect(keys.size).toBeGreaterThan(400)
  })

  it('fall back to made-up creatures without deck data', () => {
    for (const seed of SEEDS) {
      const qs = ghaltaMathQuestions(ctxFor(seed, []))
      expect(qs.length).toBeGreaterThanOrEqual(25)
      expect(new Set(qs.map(topic)).size).toBeGreaterThanOrEqual(8)
      for (const q of qs) {
        checkShape(q)
        expect(q.cards).toBeUndefined()
        CHECKS[topic(q)](q)
      }
    }
  })

  it('is deterministic per seed', () => {
    expect(ghaltaMathQuestions(ctxFor(7))).toEqual(ghaltaMathQuestions(ctxFor(7)))
  })
})
