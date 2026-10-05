import { describe, expect, it } from 'vitest'
import { cardKey, fromScryfall } from '../cards'
import type { DeckEntry } from '../types'
import { FIXTURE_CARDS } from '../scryfall.fixture'
import { evaluateHand } from '../sim/mulligan'
import { buildLesson, cardCoverage, LESSONS, type Question } from './quiz'
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
const ctx = { decklist, commander: 'Ghalta, Primal Hunger', lookup }

const checkShape = (q: Question) => {
  expect(q.prompt.length).toBeGreaterThan(5)
  expect(q.explanation.length).toBeGreaterThan(10)
  if (q.kind === 'build') {
    const answers = q.blanks!.map((b) => b.answer)
    expect(q.blanks!.length).toBeGreaterThanOrEqual(2)
    // Jede richtige Kachel liegt in der Bank, und es gibt Ablenkungen.
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

describe('Lektionen', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.title}: 5 gültige Fragen, über viele Seeds`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const qs = buildLesson(lesson.id, ctx, seed)
        expect(qs).toHaveLength(5)
        qs.forEach(checkShape)
      }
    })
  }

  it('ist mit gleichem Seed reproduzierbar', () => {
    expect(buildLesson('goldfish', ctx, 9)).toEqual(buildLesson('goldfish', ctx, 9))
  })

  it('funktioniert ohne Kartendaten für die Lektionen, die keine brauchen', () => {
    const empty = { ...ctx, lookup: () => undefined }
    expect(cardCoverage(empty)).toBe(0)
    for (const lesson of LESSONS.filter((l) => !l.needsCards)) {
      buildLesson(lesson.id, empty, 3).forEach(checkShape)
    }
  })
})

describe('Antworten stimmen', () => {
  const correctLabel = (q: Question) => q.options.find((o) => o.id === q.correct)!.label

  it('Ghalta-Mathe: Kosten passen zu den gezeigten Karten', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const q of buildLesson('ghalta', ctx, seed).filter((q) => q.id.startsWith('ghalta-') && q.cards)) {
        const power = q.cards!.reduce((s, c) => s + (lookup(c.name)!.power ?? 0), 0)
        const casts = Number(q.context!.match(/schon (\d)×/)?.[1] ?? 0)
        const generic = Math.max(0, 10 + 2 * casts - power)
        expect(correctLabel(q)).toBe(generic > 0 ? `${generic}GG` : 'GG')
      }
    }
  })

  it('Mulligan-Trainer: Antwort entspricht der Faustregel und mischt Behalten/Mulligan', () => {
    const answers: string[] = []
    for (let seed = 1; seed <= 20; seed++) {
      for (const q of buildLesson('mulligan', ctx, seed)) {
        const keep = evaluateHand(q.cards!.map((c) => lookup(c.name)!)).keep
        expect(correctLabel(q)).toBe(keep ? 'Behalten' : 'Mulligan')
        answers.push(correctLabel(q))
      }
    }
    expect(answers).toContain('Behalten')
    expect(answers).toContain('Mulligan')
  })

  it('Kampf: Trample-Schaden ist 12 minus tödlicher Schaden an Blockern', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const q of buildLesson('combat', ctx, seed).filter((q) => q.id.startsWith('trample-'))) {
        const blockers = [...q.prompt.matchAll(/(\d)\/\1/g)].map((m) => Number(m[1]))
        const deathtouch = q.prompt.includes('Deathtouch')
        const lethal = blockers.reduce((s, t) => s + (deathtouch ? 1 : t), 0)
        expect(correctLabel(q)).toBe(String(12 - lethal))
      }
    }
  })

  it('Regelfragen haben eindeutige IDs', () => {
    expect(new Set(RULES_BANK.map((q) => q.id)).size).toBe(RULES_BANK.length)
  })
})
