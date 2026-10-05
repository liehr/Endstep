import { describe, expect, it } from 'vitest'
import { DEFAULT_DECK } from './content'
import { bracketCheck, computeStats, swapCards, tallyCards, upgradeStatus } from './stats'
import { makeGame } from './test-utils'

describe('tallyCards', () => {
  it('counts case-insensitively and only once per game', () => {
    const result = tallyCards([['Gigantosaurus', 'gigantosaurus '], ['GIGANTOSAURUS', 'Beast Within']])
    expect(result).toEqual([
      { name: 'Gigantosaurus', count: 2 },
      { name: 'Beast Within', count: 1 },
    ])
  })
})

describe('computeStats', () => {
  it('returns empty values without games', () => {
    const s = computeStats([], DEFAULT_DECK)
    expect(s).toMatchObject({ total: 0, wins: 0, winRate: null, upgradeReady: false, avgCommanderTurn: null })
  })

  it('computes win rate, patterns and upgrade candidates', () => {
    const games = [
      ...Array.from({ length: 6 }, () =>
        makeGame({ result: 'loss', whyCategory: 'mistake', deadCards: ['Colossal Majesty'] }),
      ),
      makeGame({ result: 'win', decisionSkill: 'wipe', commanderTurn: 4 }),
      makeGame({ result: 'win', decisionSkill: 'wipe', commanderTurn: 6 }),
      makeGame({ result: 'loss', decisionSkill: 'wipe', wipe: 'overextended' }),
      makeGame({ result: 'loss', deck: 'Other deck', deadCards: ['Only dead there'] }),
    ]
    const s = computeStats(games, DEFAULT_DECK)

    expect(s.total).toBe(10)
    expect(s.wins).toBe(2)
    expect(s.winRate).toBeCloseTo(0.2)
    expect(s.deckGames).toBe(9)
    expect(s.upgradeReady).toBe(true)
    expect(s.upgradeCandidates).toEqual([{ name: 'Colossal Majesty', count: 6 }])
    expect(s.deadCards.map((c) => c.name)).not.toContain('Only dead there')
    expect(s.patterns.map((p) => p.id)).toEqual(['wipe'])
    expect(s.whyCounts.find((w) => w.id === 'mistake')?.count).toBe(6)
    expect(s.avgCommanderTurn).toBe(5)
    expect(s.wipes).toEqual({ kept: 0, overextended: 1 })
  })
})

describe('upgradeStatus', () => {
  const swap = (date: string, n: number, deck = DEFAULT_DECK) => ({ id: `s${n}`, deck, date, out: [], in: [], note: '', createdAt: `${date}T10:00:0${n}Z` })

  it('needs 8 games since the last swap and then allows the cards for that tier', () => {
    const games = Array.from({ length: 9 }, (_, i) => makeGame({ playedAt: `2026-09-${String(i + 1).padStart(2, '0')}` }))
    expect(upgradeStatus(games, [])).toMatchObject({ gamesSince: 9, target: 8, ready: true, round: 1, cards: 1 })
    const after = upgradeStatus(games, [swap('2026-09-06', 1)])
    expect(after).toMatchObject({ gamesSince: 4, target: 8, ready: false, round: 2, cards: 1 })
    expect(after.phases.map((p) => [p.label, p.games])).toEqual([
      ['Original', 5],
      ['After swap 1', 4],
    ])
  })

  it('counts wins per deck version', () => {
    const games = [
      makeGame({ playedAt: '2026-09-01', result: 'loss' }),
      makeGame({ playedAt: '2026-09-10', result: 'win' }),
      makeGame({ playedAt: '2026-09-11', result: 'win' }),
    ]
    expect(upgradeStatus(games, [swap('2026-09-10', 1)]).phases.map((p) => p.wins)).toEqual([0, 2])
  })

  it('only counts swaps and games of the active deck', () => {
    const games = [...Array.from({ length: 3 }, () => makeGame()), makeGame({ deck: 'Other deck', commanderTurn: 9 })]
    const s = computeStats(games, DEFAULT_DECK, { swaps: [swap('2026-09-01', 1, 'Other deck')] })
    expect(s.upgrade).toMatchObject({ round: 1, gamesSince: 3 })
    expect(s.avgCommanderTurn).toBeNull()
  })

  it('only suggests cards that are still in the deck', () => {
    const games = Array.from({ length: 3 }, () => makeGame({ deadCards: ['Harmonize', 'Colossal Majesty'] }))
    const s = computeStats(games, DEFAULT_DECK, { decklist: [{ name: 'Harmonize', qty: 1 }] })
    expect(s.upgradeCandidates.map((c) => c.name)).toEqual(['Harmonize'])
  })
})

describe('swapCards', () => {
  it('grows in steps 1, 1, 2, 2 and then stays at 3', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(swapCards)).toEqual([1, 1, 2, 2, 3, 3, 3])
  })
})

describe('bracketCheck', () => {
  it('is due from 64 games on until it is answered', () => {
    expect(bracketCheck(63, false)).toMatchObject({ due: false, done: false, target: 64 })
    expect(bracketCheck(64, false)).toMatchObject({ due: true, done: false })
    expect(bracketCheck(80, true)).toMatchObject({ due: false, done: true })
  })
})
