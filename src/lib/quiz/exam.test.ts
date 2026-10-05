import { describe, expect, it } from 'vitest'
import { cardKey, fromScryfall } from '../cards'
import { EXAM_QUESTIONS, RANKS } from '../content'
import { hasLevel, levelOf } from '../ranks'
import { FIXTURE_CARDS, FIXTURE_RULINGS } from '../scryfall.fixture'
import { mulberry32 } from '../sim/rng'
import type { DeckEntry, LessonId } from '../types'
import { buildExam } from './exam'
import { buildLesson, LESSONS } from './quiz'

const cards = new Map(FIXTURE_CARDS.map((c) => [cardKey(c.name), fromScryfall(c)]))
const lookup = (name: string) => cards.get(cardKey(name))
const decklist: DeckEntry[] = [
  { name: 'Forest', qty: 36 },
  { name: 'Llanowar Elves', qty: 6 },
  { name: 'Birds of Paradise', qty: 4 },
  { name: 'Sol Ring', qty: 2 },
  { name: 'Steel Leaf Champion', qty: 8 },
  { name: 'Pugnacious Hammerskull', qty: 8 },
  { name: 'Dungrove Elder', qty: 5 },
  { name: 'Gigantosaurus', qty: 6 },
  { name: 'Carnage Tyrant', qty: 6 },
  { name: 'Harmonize', qty: 18 },
]
const rulings = (name: string) => FIXTURE_RULINGS[cardKey(name)]
const ctx = { decklist, commander: 'Ghalta, Primal Hunger', lookup, rulings }
const ALL: LessonId[] = LESSONS.map((l) => l.id)

describe('question levels', () => {
  it('every question kind the lessons generate has a rank', () => {
    const missing = new Set<string>()
    for (const lesson of LESSONS) {
      for (let seed = 1; seed <= 15; seed++) {
        for (const q of lesson.build({ ...ctx, rng: mulberry32(seed) })) if (!hasLevel(q.key)) missing.add(q.key.split(':')[0])
      }
    }
    expect([...missing]).toEqual([])
  })

  it('a Bronze lesson keeps to Bronze questions where the lesson has enough of them', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const qs = buildLesson('cards', ctx, seed, {}, '2026-10-05', 0)
      expect(qs).toHaveLength(5)
      for (const q of qs) expect(levelOf(q.key)).toBe(0)
    }
  })

  it('every lesson still has 5 questions at every rank', () => {
    for (const lesson of LESSONS) {
      for (let rank = 0; rank < RANKS.length; rank++) {
        expect(buildLesson(lesson.id, ctx, rank + 1, {}, '2026-10-05', rank)).toHaveLength(5)
      }
    }
  })
})

describe('rank exam', () => {
  it('has unique questions from several lessons, the rank’s own level first', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const rank of [0, 1, 2, 3]) {
        const exam = buildExam(ALL, ctx, seed, rank)
        expect(exam).toHaveLength(EXAM_QUESTIONS)
        expect(new Set(exam.map((e) => e.question.key)).size).toBe(EXAM_QUESTIONS)
        expect(new Set(exam.map((e) => e.lessonId)).size).toBeGreaterThanOrEqual(4)
        const atRank = exam.filter((e) => levelOf(e.question.key) === rank).length
        expect(atRank).toBeGreaterThanOrEqual(rank === 3 ? 2 : 6)
        for (const e of exam) expect(levelOf(e.question.key)).toBeLessThanOrEqual(rank)
      }
    }
  })

  it('is deterministic for a seed', () => {
    const keys = (s: number) => buildExam(ALL, ctx, s, 1).map((e) => e.question.key)
    expect(keys(7)).toEqual(keys(7))
  })
})
