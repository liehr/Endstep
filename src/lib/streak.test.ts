import { describe, expect, it } from 'vitest'
import { weekStreak } from './streak'
import { makeGame } from './test-utils'

// 2026-10-01 is a Thursday, 2026-10-05 a Monday.
const games = (...dates: string[]) => dates.map((playedAt) => makeGame({ playedAt }))

describe('weekStreak', () => {
  it('is 0 without games', () => {
    expect(weekStreak([], '2026-10-05')).toEqual({ current: 0, best: 0, playedThisWeek: false })
  })

  it('counts consecutive weeks', () => {
    const s = weekStreak(games('2026-09-17', '2026-09-24', '2026-10-01'), '2026-10-01')
    expect(s).toEqual({ current: 3, best: 3, playedThisWeek: true })
  })

  it('stays alive as long as the current week is not over', () => {
    // Last game in the previous week, today is Monday: the streak is still alive.
    expect(weekStreak(games('2026-09-24', '2026-10-01'), '2026-10-05')).toMatchObject({
      current: 2,
      playedThisWeek: false,
    })
  })

  it('breaks after a completely skipped week but remembers the record', () => {
    const s = weekStreak(games('2026-09-03', '2026-09-10', '2026-09-17'), '2026-10-05')
    expect(s).toEqual({ current: 0, best: 3, playedThisWeek: false })
  })

  it('counts several games in one week only once', () => {
    expect(weekStreak(games('2026-10-01', '2026-10-02', '2026-10-04'), '2026-10-04').current).toBe(1)
  })

  it('treats Monday and Sunday as the same week', () => {
    expect(weekStreak(games('2026-09-28', '2026-10-04'), '2026-10-04').best).toBe(1)
  })
})
