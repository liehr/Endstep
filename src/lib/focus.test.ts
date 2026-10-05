import { describe, expect, it } from 'vitest'
import { SKILLS } from './content'
import { nextFocus, sliceAt, sortGames, spinWheel, upcomingFocus, wheelAngle, WHEEL_SKILLS } from './focus'
import { mulberry32 } from './sim/rng'
import { makeGame } from './test-utils'
import type { SkillId } from './types'

describe('nextFocus', () => {
  it('starts with mulligan', () => {
    expect(nextFocus([])).toBe('mulligan')
  })

  it('moves on from the most recently played focus', () => {
    const games = [
      makeGame({ playedAt: '2026-09-01', focus: 'mulligan' }),
      makeGame({ playedAt: '2026-09-08', focus: 'sequencing' }),
    ]
    expect(nextFocus(games)).toBe('threat')
  })

  it('starts over after the last skill', () => {
    const last = SKILLS[SKILLS.length - 1].id
    expect(nextFocus([makeGame({ focus: last })])).toBe(SKILLS[0].id)
  })

  it('takes the most recently recorded game on the same day', () => {
    const a = makeGame({ playedAt: '2026-09-08', createdAt: '2026-09-08T20:00:00Z', focus: 'combat' })
    const b = makeGame({ playedAt: '2026-09-08', createdAt: '2026-09-08T22:00:00Z', focus: 'wipe' })
    expect(sortGames([a, b])[0]).toBe(b)
    expect(nextFocus([a, b])).toBe('removal')
  })
})

describe('nextFocus with a rank', () => {
  it('only rotates through the unlocked skills', () => {
    const bronze: SkillId[] = ['mulligan', 'sequencing']
    expect(nextFocus([], bronze)).toBe('mulligan')
    expect(nextFocus([makeGame({ focus: 'mulligan' })], bronze)).toBe('sequencing')
    expect(nextFocus([makeGame({ focus: 'sequencing' })], bronze)).toBe('mulligan')
  })

  it('follows the order of the unlocked skills and starts over after a skill outside it', () => {
    const gold: SkillId[] = ['mulligan', 'sequencing', 'combat', 'removal', 'wipe']
    expect(nextFocus([makeGame({ focus: 'combat' })], gold)).toBe('removal')
    expect(nextFocus([makeGame({ focus: 'wipe' })], gold)).toBe('mulligan')
    expect(nextFocus([makeGame({ focus: 'politics' })], gold)).toBe('mulligan')
  })
})

describe('the lucky wheel', () => {
  it('lets a spun game leave the rotation where it was', () => {
    const games = [
      makeGame({ playedAt: '2026-09-01', focus: 'mulligan' }),
      makeGame({ playedAt: '2026-09-08', focus: 'politics', spun: true }),
    ]
    expect(nextFocus(games)).toBe('sequencing')
    expect(nextFocus(games, ['mulligan', 'sequencing'])).toBe('sequencing')
  })

  it('takes the spin over the rotation for the next game', () => {
    const games = [makeGame({ focus: 'mulligan' })]
    expect(upcomingFocus(games, ['mulligan', 'sequencing'], null)).toBe('sequencing')
    expect(upcomingFocus(games, ['mulligan', 'sequencing'], 'politics')).toBe('politics')
  })

  it('has every skill on it, whatever your rank', () => {
    expect(WHEEL_SKILLS).toEqual(SKILLS.map((s) => s.id))
    const seen = new Set<SkillId>()
    const random = mulberry32(7)
    for (let i = 0; i < 500; i++) seen.add(spinWheel(random))
    expect(seen.size).toBe(SKILLS.length)
    expect(spinWheel(() => 0.9999999)).toBe(SKILLS[SKILLS.length - 1].id)
  })

  it('stops with the picked slice under the pointer', () => {
    const count = WHEEL_SKILLS.length
    const random = mulberry32(3)
    let angle = 0
    for (let i = 0; i < 200; i++) {
      const index = Math.floor(random() * count)
      const next = wheelAngle(angle, index, count, 5, random() * 2 - 1)
      expect(next - angle).toBeGreaterThanOrEqual(5 * 360)
      expect(next - angle).toBeLessThan(6 * 360)
      expect(sliceAt(next, count)).toBe(index)
      angle = next
    }
  })
})
