import { describe, expect, it } from 'vitest'
import { SKILLS } from './content'
import { nextFocus, sortGames } from './focus'
import { makeGame } from './test-utils'

describe('nextFocus', () => {
  it('startet mit Mulligan', () => {
    expect(nextFocus([])).toBe('mulligan')
  })

  it('geht nach dem zuletzt gespielten Fokus weiter', () => {
    const games = [
      makeGame({ playedAt: '2026-09-01', focus: 'mulligan' }),
      makeGame({ playedAt: '2026-09-08', focus: 'sequencing' }),
    ]
    expect(nextFocus(games)).toBe('threat')
  })

  it('beginnt nach dem letzten Skill wieder von vorne', () => {
    const last = SKILLS[SKILLS.length - 1].id
    expect(nextFocus([makeGame({ focus: last })])).toBe(SKILLS[0].id)
  })

  it('nimmt bei gleichem Tag die zuletzt erfasste Runde', () => {
    const a = makeGame({ playedAt: '2026-09-08', createdAt: '2026-09-08T20:00:00Z', focus: 'combat' })
    const b = makeGame({ playedAt: '2026-09-08', createdAt: '2026-09-08T22:00:00Z', focus: 'wipe' })
    expect(sortGames([a, b])[0]).toBe(b)
    expect(nextFocus([a, b])).toBe('removal')
  })
})
