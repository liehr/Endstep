import { describe, expect, it } from 'vitest'
import { cardKey, fromScryfall } from '../cards'
import type { DeckEntry } from '../types'
import { FIXTURE_CARDS, FIXTURE_RULINGS } from '../scryfall.fixture'
import { evaluateHand } from '../sim/mulligan'
import { buildLesson, cardCoverage, LESSON_BY_ID, LESSONS, rulingsReady, type Question } from './quiz'
import { mulberry32 } from '../sim/rng'
import { recordAnswer, topicOf } from './memory'
import { RULES_BANK } from './rulesBank'

const cards = new Map(FIXTURE_CARDS.map((c) => [cardKey(c.name), fromScryfall(c)]))
const lookup = (name: string) => cards.get(cardKey(name))

const decklist: DeckEntry[] = [
  { name: 'Forest', qty: 36 },
  { name: 'Tranquil Thicket', qty: 2 },
  { name: 'Llanowar Elves', qty: 6 },
  { name: 'Birds of Paradise', qty: 4 },
  { name: 'Ilysian Caryatid', qty: 4 },
  { name: 'Sol Ring', qty: 2 },
  { name: 'Steel Leaf Champion', qty: 8 },
  { name: 'Pugnacious Hammerskull', qty: 8 },
  { name: 'Dungrove Elder', qty: 5 },
  { name: 'Gigantosaurus', qty: 6 },
  { name: 'Carnage Tyrant', qty: 6 },
  { name: 'Harmonize', qty: 12 },
]
const rulings = (name: string) => FIXTURE_RULINGS[cardKey(name)]
const ctx = { decklist, commander: 'Ghalta, Primal Hunger', lookup, rulings }

const checkShape = (q: Question) => {
  expect(q.prompt.length).toBeGreaterThan(5)
  expect(q.explanation.length).toBeGreaterThan(10)
  if (q.kind === 'build') {
    const answers = q.blanks!.map((b) => b.answer)
    expect(q.blanks!.length).toBeGreaterThanOrEqual(2)
    // Every correct tile is in the bank, and there are distractors.
    for (const a of answers) expect(q.bank).toContain(a)
    expect(q.bank!.length).toBeGreaterThan(answers.length)
    expect(new Set(q.bank).size).toBe(q.bank!.length)
    return
  }
  expect(q.options.length).toBeGreaterThanOrEqual(2)
  expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length)
  expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length)
  expect(q.options.some((o) => o.id === q.correct)).toBe(true)
  expect(q.explanation.length).toBeGreaterThan(10)
}

describe('Lessons', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.title}: 5 valid questions across many seeds`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const qs = buildLesson(lesson.id, ctx, seed)
        expect(qs).toHaveLength(5)
        qs.forEach(checkShape)
      }
    })
  }

  it('work for a blue-red deck too (lessons for Ghalta are left out)', () => {
    const izzet: DeckEntry[] = [
      { name: 'Island', qty: 30 },
      { name: 'Mountain', qty: 30 },
      { name: 'Spirebluff Canal', qty: 4 },
      { name: 'Command Tower', qty: 1 },
      { name: 'Evolving Wilds', qty: 4 },
      { name: 'Arcane Signet', qty: 4 },
      { name: 'Talrand, Sky Summoner', qty: 6 },
      { name: 'Guttersnipe', qty: 6 },
      { name: 'Counterspell', qty: 5 },
      { name: 'Lightning Bolt', qty: 4 },
      { name: 'Izzet Charm', qty: 3 },
      { name: 'Brainstorm', qty: 2 },
    ]
    const izzetCtx = { decklist: izzet, commander: 'Niv-Mizzet, Parun', lookup, rulings }
    expect(izzet.reduce((n, e) => n + e.qty, 0)).toBe(99)
    const lessons = LESSONS.filter((l) => !l.forCommander || l.forCommander(izzetCtx.commander))
    expect(lessons.map((l) => l.id)).not.toContain('ghalta')
    for (const lesson of lessons.filter((l) => l.id !== 'rulings')) {
      for (let seed = 1; seed <= 20; seed++) {
        const qs = buildLesson(lesson.id, izzetCtx, seed)
        expect(qs.length).toBeGreaterThanOrEqual(lesson.id === 'cards' ? 3 : 5)
        qs.forEach(checkShape)
        if (lesson.id === 'goldfish') expect(qs.some((q) => q.prompt.includes('Niv-Mizzet'))).toBe(true)
        if (lesson.id === 'goldfish') expect(qs.every((q) => !q.prompt.includes('Ghalta'))).toBe(true)
      }
    }
  })

  it('is reproducible with the same seed', () => {
    expect(buildLesson('goldfish', ctx, 9)).toEqual(buildLesson('goldfish', ctx, 9))
  })

  it('locks the rulings lesson until enough rulings are loaded', () => {
    expect(rulingsReady(ctx)).toBe(true)
    expect(rulingsReady({ ...ctx, rulings: undefined })).toBe(false)
  })

  it('works without card data for the lessons that don’t need it', () => {
    const empty = { ...ctx, lookup: () => undefined }
    expect(cardCoverage(empty)).toBe(0)
    for (const lesson of LESSONS.filter((l) => !l.needsCards)) {
      buildLesson(lesson.id, empty, 3).forEach(checkShape)
    }
  })
})

describe('Answers are correct', () => {
  const correctLabel = (q: Question) => q.options.find((o) => o.id === q.correct)!.label

  it('Ghalta Math: cost matches the cards shown', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const q of buildLesson('ghalta', ctx, seed).filter((q) => q.key.startsWith('ghalta-cost:') && q.cards)) {
        const power = q.cards!.reduce((s, c) => s + (lookup(c.name)!.power ?? 0), 0)
        const m = q.context!.match(/cast (once|(\d) times) before/)
        const casts = m ? (m[2] ? Number(m[2]) : 1) : 0
        const generic = Math.max(0, 10 + 2 * casts - power)
        expect(correctLabel(q)).toBe(generic > 0 ? `${generic}GG` : 'GG')
      }
    }
  })

  it('Mulligan Trainer: answer follows the rule of thumb and mixes Keep/Mulligan', () => {
    const answers: string[] = []
    for (let seed = 1; seed <= 20; seed++) {
      for (const q of buildLesson('mulligan', ctx, seed)) {
        const keep = evaluateHand(q.cards!.map((c) => lookup(c.name)!), { bigCreature: true }).keep
        expect(correctLabel(q)).toBe(keep ? 'Keep' : 'Mulligan')
        answers.push(correctLabel(q))
      }
    }
    expect(answers).toContain('Keep')
    expect(answers).toContain('Mulligan')
  })

  it('Combat: trample damage is power minus lethal damage to blockers', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const q of buildLesson('combat', ctx, seed).filter((q) => ['trample', 'deathtouch'].includes(topicOf(q.key)))) {
        const blockers = [...q.prompt.matchAll(/(\d)\/\1/g)].map((m) => Number(m[1]))
        const deathtouch = q.prompt.includes('Deathtouch')
        const lethal = blockers.reduce((s, t) => s + (deathtouch ? 1 : t), 0)
        expect(correctLabel(q)).toBe(String(12 - lethal))
        // Ghalta is the commander and shown as a card.
        expect(q.prompt).toMatch(/^Ghalta \(12\/12, Trample/)
      }
    }
  })

  it('Combat: other decks get their own commander or a made-up trampler', () => {
    const niv = { ...ctx, commander: 'Niv-Mizzet, Parun', decklist: [{ name: 'Island', qty: 50 }, { name: 'Guttersnipe', qty: 49 }] }
    for (let seed = 1; seed <= 30; seed++) {
      for (const q of buildLesson('combat', niv, seed)) {
        expect(q.prompt).not.toContain('Ghalta')
        if (topicOf(q.key) === 'trample') {
          const blockers = [...q.prompt.matchAll(/(\d)\/\1(?! creature)/g)].map((m) => Number(m[1]))
          expect(q.prompt).toMatch(/^A 7\/7 creature with Trample/)
          expect(correctLabel(q)).toBe(String(Math.max(0, 7 - blockers.reduce((s, b) => s + b, 0))))
        }
        if (q.id.startsWith('cmd-damage-')) {
          // Niv-Mizzet (5/5) has no Trample: blocked means no damage.
          const already = Number(q.prompt.match(/has (\d+) commander damage/)![1])
          const dealt = q.prompt.includes('is blocked') ? 0 : 5
          expect(correctLabel(q)).toBe(already + dealt >= 21 ? 'Yes, they lose' : 'No, not yet')
        }
        if (q.id === 'blocker-gone-plain') expect(q.prompt).toMatch(/^Guttersnipe \(2\/2\)/)
      }
    }
  })

  it('rules questions have unique IDs', () => {
    expect(new Set(RULES_BANK.map((q) => q.id)).size).toBe(RULES_BANK.length)
  })

  it('Card Rulings: the ruling belongs to the correct card and hides its name', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const q of buildLesson('rulings', ctx, seed)) {
        const name = correctLabel(q)
        const texts = FIXTURE_RULINGS[cardKey(name)].map((r) => r.text)
        const shown = q.context!.slice(1, -1)
        const strip = (t: string) => t.replace(/Ghalta|Dungrove Elder|Ilysian Caryatid|Pugnacious Hammerskull|[Tt]his card/g, '~')
        expect(texts.some((t) => strip(t) === strip(shown))).toBe(true)
        expect(shown).not.toContain(name.split(',')[0])
      }
    }
  })
})

describe('Question memory in lessons', () => {
  const today = '2026-10-05'

  it('a fresh lesson avoids questions you have already seen', () => {
    let memory = {}
    const first = buildLesson('rules', ctx, 1, memory, today)
    for (const q of first) memory = recordAnswer(memory, q.key, true, today)
    const second = buildLesson('rules', ctx, 2, memory, today)
    const firstKeys = new Set(first.map((q) => q.key))
    expect(second.some((q) => firstKeys.has(q.key))).toBe(false)
  })

  it('a wrong answer comes back in the next lesson', () => {
    const first = buildLesson('rules', ctx, 1, {}, today)
    const memory = recordAnswer({}, first[0].key, false, today)
    for (let seed = 2; seed <= 20; seed++) {
      expect(buildLesson('rules', ctx, seed, memory, today).map((q) => q.key)).toContain(first[0].key)
    }
  })

  it('Know Your Cards: never asks two questions about the same card', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const groups = buildLesson('cards', ctx, seed).map((q) => q.group)
      expect(new Set(groups).size).toBe(groups.length)
    }
  })

  it('Know Your Cards: goes through the whole deck before a card comes back', () => {
    const deckNames = new Set(
      decklist.map((e) => lookup(e.name)).filter((c) => c && !c.typeLine.startsWith('Basic Land')).map((c) => c!.name),
    )
    const rounds = Math.floor(deckNames.size / 5)
    for (let start = 1; start <= 20; start++) {
      let memory = {}
      const asked: string[] = []
      for (let lesson = 0; lesson < rounds; lesson++) {
        for (const [i, q] of buildLesson('cards', ctx, start * 100 + lesson, memory, today).entries()) {
          asked.push(q.group!)
          memory = recordAnswer(memory, q.key, true, today, { at: lesson * 10 + i + 1, group: q.group })
        }
      }
      expect(new Set(asked).size).toBe(asked.length)
    }
  })

  it('brings at most 2 due reviews per lesson, the rest is new', () => {
    let memory = {}
    for (const q of RULES_BANK.slice(0, 6)) memory = recordAnswer(memory, `rule-${q.id}`, false, today)
    for (let seed = 1; seed <= 20; seed++) {
      const due = buildLesson('rules', ctx, seed, memory, today).filter((q) => q.key in memory)
      expect(due).toHaveLength(2)
    }
  })
})

describe('Know Your Cards: new question types', () => {
  const correctLabel = (q: Question) => q.options.find((o) => o.id === q.correct)!.label
  const all = (topic: string) => {
    const out: Question[] = []
    for (let seed = 1; seed <= 150; seed++) {
      out.push(...LESSON_BY_ID.cards.build({ ...ctx, lookup: withArt, rng: mulberry32(seed) }).filter((q) => q.key.startsWith(`${topic}:`)))
    }
    return out
  }
  // The fixture has no images; give every card its own artwork.
  const withArt = (name: string) => {
    const c = lookup(name)
    return c && { ...c, art: `art:${c.name}` }
  }
  const card = (name: string) => withArt(name)!

  it('every type shows up and has correct answers', () => {
    for (const topic of ['card-art', 'card-text', 'card-pt', 'card-type', 'card-keyword', 'card-mv', 'card-compare', 'card-which-type']) {
      expect(all(topic).length, topic).toBeGreaterThan(0)
    }
    for (const q of all('card-art')) expect(card(correctLabel(q)).art).toBe(q.face!.art)
    for (const q of all('card-pt')) expect(`${card(q.group!).powerText}/${card(q.group!).toughness}`).toBe(correctLabel(q))
    for (const q of all('card-mv')) expect(String(card(q.group!).cmc)).toBe(correctLabel(q))
    for (const q of all('card-text')) expect(correctLabel(q)).toBe(q.group)
    for (const q of all('card-keyword')) {
      const text = card(q.group!).oracleText
      expect(text.toLowerCase()).toContain(correctLabel(q).toLowerCase())
      for (const o of q.options.filter((o) => o.id !== q.correct)) expect(text.toLowerCase()).not.toContain(o.label.toLowerCase())
    }
    for (const q of all('card-compare')) {
      const values = q.options.map((o) => card(o.label).cmc)
      const best = q.prompt.includes('highest') ? Math.max(...values) : Math.min(...values)
      expect(card(correctLabel(q)).cmc).toBe(best)
      expect(values.filter((v) => v === best)).toHaveLength(1)
    }
    for (const q of all('card-which-type')) {
      const type = q.prompt.match(/is an? (\w+)\?/)![1]
      const hasType = (name: string) => new RegExp(`\\b${type}\\b`, 'i').test(card(name).typeLine)
      expect(q.options.filter((o) => hasType(o.label)).map((o) => o.id)).toEqual([q.correct])
    }
  })
})
