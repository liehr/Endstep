import { describe, expect, it } from 'vitest'
import { weekStreak } from './streak'
import { makeGame } from './test-utils'

// 2026-10-01 ist ein Donnerstag, 2026-10-05 ein Montag.
const games = (...dates: string[]) => dates.map((playedAt) => makeGame({ playedAt }))

describe('weekStreak', () => {
  it('ist 0 ohne Spiele', () => {
    expect(weekStreak([], '2026-10-05')).toEqual({ current: 0, best: 0, playedThisWeek: false })
  })

  it('zählt aufeinanderfolgende Wochen', () => {
    const s = weekStreak(games('2026-09-17', '2026-09-24', '2026-10-01'), '2026-10-01')
    expect(s).toEqual({ current: 3, best: 3, playedThisWeek: true })
  })

  it('bleibt bestehen, solange die laufende Woche noch nicht vorbei ist', () => {
    // Letzte Runde in der Vorwoche, heute ist Montag: Serie lebt noch.
    expect(weekStreak(games('2026-09-24', '2026-10-01'), '2026-10-05')).toMatchObject({
      current: 2,
      playedThisWeek: false,
    })
  })

  it('reißt nach einer komplett ausgelassenen Woche ab, merkt sich aber den Rekord', () => {
    const s = weekStreak(games('2026-09-03', '2026-09-10', '2026-09-17'), '2026-10-05')
    expect(s).toEqual({ current: 0, best: 3, playedThisWeek: false })
  })

  it('zählt mehrere Runden in einer Woche nur einmal', () => {
    expect(weekStreak(games('2026-10-01', '2026-10-02', '2026-10-04'), '2026-10-04').current).toBe(1)
  })

  it('erkennt Montag und Sonntag als dieselbe Woche', () => {
    expect(weekStreak(games('2026-09-28', '2026-10-04'), '2026-10-04').best).toBe(1)
  })
})
