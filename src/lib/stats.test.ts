import { describe, expect, it } from 'vitest'
import { DEFAULT_DECK } from './content'
import { computeStats, tallyCards } from './stats'
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
