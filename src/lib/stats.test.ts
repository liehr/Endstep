import { describe, expect, it } from 'vitest'
import { DEFAULT_DECK } from './content'
import { computeStats, tallyCards, upgradeStatus } from './stats'
import { makeGame } from './test-utils'

describe('tallyCards', () => {
  it('zählt unabhängig von Groß-/Kleinschreibung und nur einmal pro Spiel', () => {
    const result = tallyCards([['Gigantosaurus', 'gigantosaurus '], ['GIGANTOSAURUS', 'Beast Within']])
    expect(result).toEqual([
      { name: 'Gigantosaurus', count: 2 },
      { name: 'Beast Within', count: 1 },
    ])
  })
})

describe('computeStats', () => {
  it('liefert leere Werte ohne Spiele', () => {
    const s = computeStats([], DEFAULT_DECK)
    expect(s).toMatchObject({ total: 0, wins: 0, winRate: null, upgradeReady: false, avgGhaltaTurn: null })
  })

  it('berechnet Siegquote, Muster und Upgrade-Kandidaten', () => {
    const games = [
      ...Array.from({ length: 6 }, () =>
        makeGame({ result: 'loss', whyCategory: 'mistake', deadCards: ['Colossal Majesty'] }),
      ),
      makeGame({ result: 'win', decisionSkill: 'wipe', ghaltaTurn: 4 }),
      makeGame({ result: 'win', decisionSkill: 'wipe', ghaltaTurn: 6 }),
      makeGame({ result: 'loss', decisionSkill: 'wipe', wipe: 'overextended' }),
      makeGame({ result: 'loss', deck: 'Anderes Deck', deadCards: ['Nur dort tot'] }),
    ]
    const s = computeStats(games, DEFAULT_DECK)

    expect(s.total).toBe(10)
    expect(s.wins).toBe(2)
    expect(s.winRate).toBeCloseTo(0.2)
    expect(s.deckGames).toBe(9)
    expect(s.upgradeReady).toBe(true)
    expect(s.upgradeCandidates).toEqual([{ name: 'Colossal Majesty', count: 6 }])
    expect(s.deadCards.map((c) => c.name)).not.toContain('Nur dort tot')
    expect(s.patterns.map((p) => p.id)).toEqual(['wipe'])
    expect(s.whyCounts.find((w) => w.id === 'mistake')?.count).toBe(6)
    expect(s.avgGhaltaTurn).toBe(5)
    expect(s.wipes).toEqual({ kept: 0, overextended: 1 })
  })
})

describe('upgradeStatus', () => {
  const swap = (date: string, n: number) => ({ id: `s${n}`, date, out: [], in: [], note: '', createdAt: `${date}T10:00:0${n}Z` })

  it('braucht ohne Swap 8 Spiele, danach 5 seit dem letzten Swap', () => {
    const games = Array.from({ length: 9 }, (_, i) => makeGame({ playedAt: `2026-09-${String(i + 1).padStart(2, '0')}` }))
    expect(upgradeStatus(games, [])).toMatchObject({ gamesSince: 9, target: 8, ready: true })
    const after = upgradeStatus(games, [swap('2026-09-06', 1)])
    expect(after).toMatchObject({ gamesSince: 4, target: 5, ready: false })
    expect(after.phases.map((p) => [p.label, p.games])).toEqual([
      ['Original', 5],
      ['Nach Swap 1', 4],
    ])
  })

  it('zählt Siege je Deckversion', () => {
    const games = [
      makeGame({ playedAt: '2026-09-01', result: 'loss' }),
      makeGame({ playedAt: '2026-09-10', result: 'win' }),
      makeGame({ playedAt: '2026-09-11', result: 'win' }),
    ]
    expect(upgradeStatus(games, [swap('2026-09-10', 1)]).phases.map((p) => p.wins)).toEqual([0, 2])
  })

  it('schlägt nur Karten vor, die noch im Deck sind', () => {
    const games = Array.from({ length: 3 }, () => makeGame({ deadCards: ['Harmonize', 'Colossal Majesty'] }))
    const s = computeStats(games, DEFAULT_DECK, { decklist: [{ name: 'Harmonize', qty: 1 }] })
    expect(s.upgradeCandidates.map((c) => c.name)).toEqual(['Harmonize'])
  })
})
