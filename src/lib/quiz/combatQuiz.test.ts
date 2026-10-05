import { describe, expect, it } from 'vitest'
import { cardKey, fromScryfall } from '../cards'
import { FIXTURE_CARDS } from '../scryfall.fixture'
import { mulberry32 } from '../sim/rng'
import type { DeckEntry } from '../types'
import { combatQuestions } from './combatQuiz'
import type { Question, QuizContext } from './question'

const cards = new Map(FIXTURE_CARDS.map((c) => [cardKey(c.name), fromScryfall(c)]))
const lookup = (name: string) => cards.get(cardKey(name))

const decklist: DeckEntry[] = [
  { name: 'Forest', qty: 36 },
  { name: 'Llanowar Elves', qty: 6 },
  { name: 'Birds of Paradise', qty: 4 },
  { name: 'Whisperer of the Wilds', qty: 4 },
  { name: 'Steel Leaf Champion', qty: 8 },
  { name: 'Pugnacious Hammerskull', qty: 8 },
  { name: 'Dungrove Elder', qty: 5 },
  { name: 'Gigantosaurus', qty: 6 },
  { name: 'Carnage Tyrant', qty: 6 },
  { name: 'Talrand, Sky Summoner', qty: 2 },
  { name: 'Guttersnipe', qty: 2 },
]

const ctxFor = (seed: number, deck = decklist, commander = 'Ghalta, Primal Hunger', look = lookup): QuizContext => ({
  rng: mulberry32(seed),
  decklist: deck,
  commander,
  lookup: look,
})

const checkShape = (q: Question) => {
  expect(q.prompt.length).toBeGreaterThan(5)
  expect(q.explanation.length).toBeGreaterThan(10)
  expect(q.options.length).toBeGreaterThanOrEqual(2)
  expect(q.options.length).toBeLessThanOrEqual(4)
  expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length)
  expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length)
  expect(q.options.filter((o) => o.id === q.correct)).toHaveLength(1)
  expect(q.id.startsWith(`${q.key.split(':')[0]}-`)).toBe(true)
}

const correctLabel = (q: Question) => q.options.find((o) => o.id === q.correct)!.label
const OUT = (attackerDies: boolean, blockerDies: boolean) =>
  attackerDies ? (blockerDies ? 'Both die' : 'Only your creature dies') : blockerDies ? 'Only the blocker dies' : 'Neither dies'
const yn = (b: boolean) => (b ? 'Yes' : 'No')
const pt = (s: string) => s.split('/').map(Number) as [number, number]

/** Recomputes the right answer from the key's parameters (rules applied independently). */
function expected(q: Question): string {
  const [topic, ...k] = q.key.split(':')
  switch (topic) {
    case 'block-outcome': {
      const [[p, t], [a, b]] = [pt(k[0]), pt(k[1])]
      return OUT(a >= t, p >= b)
    }
    case 'first-strike-block': {
      const [[p, t], [a, b]] = [pt(k[0]), pt(k[1])]
      const dead = a >= t
      return OUT(dead, !dead && p >= b)
    }
    case 'double-strike-block': {
      const [[p, t], [a, b]] = [pt(k[0]), pt(k[1])]
      // First hit, then (if alive) both hit at the same time.
      if (a >= t) return OUT(true, false)
      return OUT(a + a >= t, p >= b)
    }
    case 'deathtouch-block': {
      const [[p], [a, b]] = [pt(k[1]), pt(k[2])]
      expect(a).toBeGreaterThan(0)
      if (k[0] === 'fs') return OUT(p < b, p >= b)
      return OUT(true, p >= b)
    }
    case 'indestructible-block': {
      if (k[0] === 'trample') {
        const p = Number(k[1])
        const [, b] = pt(k[2])
        return String(Math.max(0, p - b))
      }
      const [[, t], [a]] = [pt(k[1]), pt(k[2])]
      return OUT(a >= t, false)
    }
    case 'combat-trick': {
      const [[p, t], [a, b], x] = [pt(k[1]), pt(k[2]), Number(k[3])]
      return k[0] === 'you' ? OUT(a >= t + x, p + x >= b) : OUT(a + x >= t, p >= b + x)
    }
    case 'double-block': {
      const [[p], [, b1], [, b2]] = [pt(k[0]), pt(k[1]), pt(k[2])]
      return p >= b1 + b2 ? 'Both' : p >= Math.min(b1, b2) ? 'One' : 'None'
    }
    case 'gang-block': {
      const [[, t], [a1], [a2]] = [pt(k[0]), pt(k[1]), pt(k[2])]
      return yn(a1 + a2 < t)
    }
    case 'can-block':
      return yn(['fly-reach', 'fly-fly', 'ground-fly', 'menace-two', 'new'].includes(k[0]))
    case 'summoning-sick':
      return yn(['haste', 'block', 'eot'].includes(k[0]))
    case 'vigilance':
      return yn(k[0] === 'vig-block')
    case 'trample-marked': {
      const [p, [, b], d] = [Number(k[0]), pt(k[1]), Number(k[2])]
      return String(Math.max(0, p - (b - d)))
    }
    case 'trample-pump': {
      const [p, [, b], x] = [Number(k[1]), pt(k[2]), Number(k[3])]
      return String(k[0] === 'you' ? Math.max(0, p + x - b) : Math.max(0, p - b - x))
    }
    case 'trample-assign': {
      const [p, [, s], [, b]] = [Number(k[1]), pt(k[2]), pt(k[3])]
      expect(p).toBeGreaterThan(s + b)
      // Only skipping a blocker while sending damage to the player is illegal.
      return yn(k[0] !== 'skip')
    }
    case 'double-strike': {
      const p = Number(k[1])
      if (k[0] === 'unblocked') return String(2 * p)
      if (k[0] === 'blocked') return '0'
      // Step by step: first strike, then regular damage with marked damage counted.
      const [, b] = pt(k[2])
      let marked = 0
      let toPlayer = 0
      let alive = true
      for (let step = 0; step < 2; step++) {
        if (!alive) {
          toPlayer += p
          continue
        }
        const lethal = b - marked
        const onBlocker = Math.min(p, lethal)
        marked += onBlocker
        toPlayer += p - onBlocker
        if (marked >= b) alive = false
      }
      return String(toPlayer)
    }
    case 'lifelink': {
      const [p, t] = pt(k[1])
      if (k[0] === 'fs-kill') {
        expect(pt(k[2])[0]).toBeGreaterThanOrEqual(t)
        return '0'
      }
      if (k[0] === 'fs-weak') expect(pt(k[2])[0]).toBeLessThan(t)
      return String(p)
    }
    case 'marked-damage': {
      const [t, d] = [Number(k[1]), Number(k[2])]
      expect(d).toBeLessThan(t)
      return String(k[0] === 'same' ? t - d : t)
    }
    case 'alpha-strike':
    case 'lethal-check': {
      let total = 0
      for (const part of k[0].split('+')) {
        const m = part.match(/^(\d+)(t?)>(\d+|-)$/)!
        const p = Number(m[1])
        if (m[3] === '-') total += p
        else if (m[2]) total += Math.max(0, p - Number(m[3]))
      }
      return topic === 'alpha-strike' ? String(total) : yn(total >= Number(k[1]))
    }
    case 'cmd-hits': {
      const [p, bonus, d] = k.slice(0, 3).map(Number)
      let hits = 0
      for (let dmg = d; dmg < 21; dmg += p + bonus) hits++
      return `${hits} ${hits === 1 ? 'hit' : 'hits'}`
    }
    case 'cmd-vs-life': {
      const [p, life, c] = k.slice(0, 3).map(Number)
      expect(c).toBeLessThan(21)
      expect(life + c).toBeLessThanOrEqual(40)
      const byLife = life <= p
      const byCmd = c + p >= 21
      return byLife && byCmd ? 'Yes, both at once' : byLife ? 'Yes, their life hits 0' : byCmd ? 'Yes, 21 commander damage' : 'No, they survive'
    }
    case 'cmd-tally':
      return k[0]
    case 'best-block':
      return ''
    default:
      throw new Error(`Unknown topic ${topic}`)
  }
}

const statsOf = (label: string) => pt(label.match(/(\d+\/\d+)\)?( creature)?$/)![1])

describe('Combat questions', () => {
  it('have valid shapes, unique ids and keys, and many topics across seeds', () => {
    const allTopics = new Set<string>()
    for (let seed = 1; seed <= 300; seed++) {
      const qs = combatQuestions(ctxFor(seed))
      expect(qs.length).toBeGreaterThanOrEqual(30)
      expect(qs.length).toBeLessThanOrEqual(50)
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length)
      expect(new Set(qs.map((q) => q.key)).size).toBe(qs.length)
      const topics = new Set(qs.map((q) => q.key.split(':')[0]))
      expect(topics.size).toBeGreaterThanOrEqual(10)
      topics.forEach((t) => allTopics.add(t))
      qs.forEach(checkShape)
    }
    expect(allTopics.size).toBeGreaterThanOrEqual(20)
  })

  it('have the right answer for every type', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const q of combatQuestions(ctxFor(seed))) {
        if (q.key.startsWith('best-block:')) {
          const [a, b] = pt(q.key.split(':')[1])
          const good = q.options.filter((o) => {
            const [p, t] = statsOf(o.label)
            return p >= b && t > a
          })
          expect(good.map((o) => o.id)).toEqual([q.correct])
          continue
        }
        expect(correctLabel(q), q.key).toBe(expected(q))
      }
    }
  })

  it('show the creatures’ stats from the key in the text', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const q of combatQuestions(ctxFor(seed))) {
        const text = `${q.prompt} ${q.context ?? ''}`
        for (const part of q.key.split(':').slice(1)) if (/^\d+\/\d+$/.test(part)) expect(text, q.key).toContain(part)
      }
    }
  })

  it('use your own creatures with their printed P/T', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 100; seed++) {
      for (const q of combatQuestions(ctxFor(seed))) {
        for (const c of q.cards ?? []) {
          const info = lookup(c.name)!
          expect(c.caption).toBe(`${info.powerText}/${info.toughness}`)
          seen.add(c.name)
        }
      }
    }
    // Your commander and several deck creatures show up; risky ones never attack.
    expect(seen).toContain('Ghalta, Primal Hunger')
    expect(seen).toContain('Gigantosaurus')
    expect(seen).toContain('Carnage Tyrant')
    expect(seen).not.toContain('Steel Leaf Champion')
    expect(seen).not.toContain('Birds of Paradise')
  })

  it('work with an empty decklist and no card data (made-up creatures)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const qs = combatQuestions(ctxFor(seed, [], '', () => undefined))
      expect(qs.length).toBeGreaterThanOrEqual(30)
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length)
      expect(new Set(qs.map((q) => q.key.split(':')[0])).size).toBeGreaterThanOrEqual(10)
      for (const q of qs) {
        checkShape(q)
        expect(q.cards).toBeUndefined()
        if (q.key.startsWith('best-block:')) continue
        expect(correctLabel(q), q.key).toBe(expected(q))
      }
    }
  })

  it('vary a lot between lessons', () => {
    const keys = new Set<string>()
    for (let seed = 1; seed <= 50; seed++) combatQuestions(ctxFor(seed)).forEach((q) => keys.add(q.key))
    expect(keys.size).toBeGreaterThan(1200)
  })

  it('is reproducible with the same seed', () => {
    expect(combatQuestions(ctxFor(7))).toEqual(combatQuestions(ctxFor(7)))
  })
})
