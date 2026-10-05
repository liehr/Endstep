import { describe, expect, it } from 'vitest'
import { RANK_GAMES, RANK_LESSONS, RANKS, SKILLS } from './content'
import { sanitizeData } from './data'
import { currentRank, filterByLevel, levelOf, promote, rankProgress, rankStart, skillRank, swapBonus, TOP_RANK, unlockedSkills } from './ranks'
import { upgradeStatus } from './stats'
import { makeGame } from './test-utils'
import type { Promotion, Swap, TrainingResult } from './types'

const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T20:00:00.000Z`
const promo = (rank: number, day: number): Promotion => ({ rank, date: at(day).slice(0, 10), createdAt: at(day) })
const lesson = (day: number, correct = 5): TrainingResult => ({ lessonId: 'combat', date: at(day).slice(0, 10), correct, total: 5, createdAt: at(day) })
const swap = (day: number): Swap => ({ id: `s${day}`, deck: 'D', date: at(day).slice(0, 10), out: [], in: [], note: '', createdAt: at(day) })

describe('ranks', () => {
  it('starts at Bronze and climbs one rank per promotion', () => {
    expect(currentRank([])).toBe(0)
    expect(rankStart([])).toBe('')
    let p: Promotion[] = []
    for (let i = 1; i <= TOP_RANK + 2; i++) p = promote(p, new Date(at(i)))
    expect(currentRank(p)).toBe(TOP_RANK)
    expect(p).toHaveLength(TOP_RANK)
    expect(RANKS[currentRank(p)].id).toBe('grandmaster')
  })

  it('unlocks every focus skill exactly once, all of them by Platinum', () => {
    const all = RANKS.flatMap((r) => r.skills)
    expect(new Set(all).size).toBe(all.length)
    expect(unlockedSkills(0)).toEqual(['mulligan', 'sequencing'])
    expect(unlockedSkills(1)).toEqual(['mulligan', 'sequencing', 'combat'])
    expect([...unlockedSkills(3)].sort()).toEqual(SKILLS.map((s) => s.id).sort())
    expect(unlockedSkills(TOP_RANK)).toEqual(unlockedSkills(3))
    expect(skillRank('politics')).toBe(3)
  })

  it('reads question levels from the key, including * patterns', () => {
    expect(levelOf('card-cost:Llanowar Elves')).toBe(0)
    expect(levelOf('trample:5:2+3')).toBe(1)
    expect(levelOf('ruling-Ghalta, Primal Hunger:abc')).toBe(2)
    expect(levelOf('alpha-strike:x')).toBe(4)
    expect(levelOf('unknown-topic:x')).toBe(0)
  })

  it('filters questions by level and fills up with the easiest harder ones', () => {
    const qs = [{ key: 'alpha-strike:1' }, { key: 'card-cost:a' }, { key: 'combat-trick:1' }, { key: 'trample:1' }]
    expect(filterByLevel(qs, 0, 1)).toEqual([{ key: 'card-cost:a' }])
    expect(filterByLevel(qs, 0, 2)).toEqual([{ key: 'card-cost:a' }, { key: 'trample:1' }])
    expect(filterByLevel(qs, 4, 2)).toEqual(qs)
  })

  it('unlocks the exam after enough games and good lessons in the rank', () => {
    const games = Array.from({ length: RANK_GAMES }, (_, i) => makeGame({ createdAt: at(10 + i) }))
    const lessons = Array.from({ length: RANK_LESSONS }, (_, i) => lesson(10 + i))
    // Bronze counts your whole history.
    expect(rankProgress([], games, lessons).examReady).toBe(true)
    expect(rankProgress([], games.slice(1), lessons).examReady).toBe(false)
    expect(rankProgress([], games, [...lessons.slice(1), lesson(20, 3)]).examReady).toBe(false)
    // After a promotion only what came later counts.
    const silver = [promo(1, 15)]
    const p = rankProgress(silver, games, lessons)
    expect(p).toMatchObject({ rank: 1, games: 3, lessons: 0, examReady: false, top: false })
    expect(rankProgress([promo(TOP_RANK, 1)], games, lessons)).toMatchObject({ top: true, examReady: false })
  })

  it('gives one bonus swap card after a promotion, until the next swap', () => {
    expect(swapBonus([], [])).toBe(0)
    expect(swapBonus([promo(1, 5)], [])).toBe(1)
    expect(swapBonus([promo(1, 5), promo(2, 6)], [])).toBe(1)
    expect(swapBonus([promo(1, 5)], [swap(7)])).toBe(0)
    expect(swapBonus([promo(1, 8)], [swap(7)])).toBe(1)
    expect(upgradeStatus([], [], 1)).toMatchObject({ cards: 2, bonus: 1 })
  })

  it('keeps promotions through sanitizeData and drops broken ones', () => {
    const data = sanitizeData({ promotions: [promo(1, 3), { rank: 99, createdAt: at(4) }, { rank: 2 }, 'x'] })
    expect(data.promotions).toEqual([promo(1, 3)])
    expect(sanitizeData({}).promotions).toEqual([])
  })
})
