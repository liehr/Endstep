import { describe, expect, it } from 'vitest'
import { emptyData, removeDeck, switchDeck } from '../data'
import { applySwap, DEFAULT_DECKLIST } from '../decklist'
import { makeGame } from '../test-utils'
import type { AppData, Swap } from '../types'
import { mergeSync, sameSyncData, stableStringify, syncable, trackChanges } from './merge'

const T1 = '2026-10-05T10:00:00.000Z'
const T2 = '2026-10-05T11:00:00.000Z'
const T3 = '2026-10-05T12:00:00.000Z'

function chosen(overrides: Partial<AppData> = {}): AppData {
  return { ...emptyData(), deckChosen: true, ...overrides }
}

function swap(id: string, createdAt: string, out: string[], into: string[], deck = emptyData().settings.defaultDeck): Swap {
  return { id, deck, date: createdAt.slice(0, 10), out, in: into, note: '', createdAt }
}

/** Both devices sync: they must end up with the same data. */
function converge(a: AppData, b: AppData) {
  const ab = mergeSync(a, b)
  const ba = mergeSync(b, a)
  expect(stableStringify(syncable(ab))).toBe(stableStringify(syncable(ba)))
  // Syncing again changes nothing.
  expect(sameSyncData(mergeSync(ab, ba), ab)).toBe(true)
  return ab
}

describe('mergeSync', () => {
  it('keeps games, lessons, quiz answers and ranks from both devices', () => {
    const phone = chosen({
      games: [makeGame({ id: 'p' })],
      training: [{ lessonId: 'rules', date: '2026-10-05', correct: 5, total: 8, createdAt: T1 }],
      quiz: { q1: { box: 2, due: '2026-10-07', seen: 2, wrong: 0, last: '2026-10-05' } },
      promotions: [{ rank: 1, date: '2026-10-05', createdAt: T1 }],
    })
    const pc = chosen({
      games: [makeGame({ id: 'c' })],
      training: [{ lessonId: 'combat', date: '2026-10-05', correct: 8, total: 8, createdAt: T2 }],
      quiz: { q2: { box: 1, due: '2026-10-06', seen: 1, wrong: 1, last: '2026-10-05' } },
    })
    const merged = converge(phone, pc)
    expect(merged.games.map((g) => g.id).sort()).toEqual(['c', 'p'])
    expect(merged.training).toHaveLength(2)
    expect(Object.keys(merged.quiz).sort()).toEqual(['q1', 'q2'])
    expect(merged.promotions).toHaveLength(1)
  })

  it('keeps the most recently edited version of a game', () => {
    const old = makeGame({ id: 'g', winner: 'Old', updatedAt: T1 })
    const merged = converge(chosen({ games: [old] }), chosen({ games: [{ ...old, winner: 'New', updatedAt: T2 }] }))
    expect(merged.games[0].winner).toBe('New')
  })

  it('a deleted game stays deleted, but an edit after the delete brings it back', () => {
    const game = makeGame({ id: 'g', updatedAt: T1 })
    const deletedHere = chosen({ deleted: { 'game:g': T2 } })
    expect(converge(deletedHere, chosen({ games: [game] })).games).toEqual([])
    const editedLater = { ...game, updatedAt: T3 }
    expect(converge(deletedHere, chosen({ games: [editedLater] })).games).toHaveLength(1)
  })

  it('takes settings from the device that changed them last', () => {
    const a = chosen({ settings: { ...emptyData().settings, theme: 'dark' }, stamps: { settings: T2, deck: '' } })
    const b = chosen({ settings: { ...emptyData().settings, theme: 'light', dailyGoal: 3 }, stamps: { settings: T1, deck: '' } })
    const merged = converge(a, b)
    expect(merged.settings.theme).toBe('dark')
    expect(merged.settings.dailyGoal).toBe(1)
  })

  it('agrees on one version even when nothing was stamped yet', () => {
    const a = chosen({ settings: { ...emptyData().settings, theme: 'dark' } })
    const b = chosen({ settings: { ...emptyData().settings, theme: 'light' } })
    converge(a, b)
  })

  it('a new device takes the deck and settings from the cloud', () => {
    const cloud = chosen({ commander: 'Atraxa, Praetors’ Voice', settings: { ...emptyData().settings, defaultDeck: 'Atraxa', theme: 'dark' } })
    const fresh = emptyData()
    const merged = converge(fresh, cloud)
    expect(merged.deckChosen).toBe(true)
    expect(merged.commander).toBe(cloud.commander)
    expect(merged.settings.theme).toBe('dark')
    expect(merged.settings.defaultDeck).toBe('Atraxa')
  })

  it('keeps the deck the other device was playing under your decks', () => {
    const base = chosen()
    const phone = trackChanges(base, switchDeck(base, { name: 'Atraxa', commander: 'Atraxa', commanderSet: null, decklist: [], precon: null }), T2)
    const pc = { ...base, stamps: { settings: '', deck: T1 } }
    const merged = converge(phone, pc)
    expect(merged.settings.defaultDeck).toBe('Atraxa')
    expect(merged.decks.map((d) => d.name)).toEqual([base.settings.defaultDeck])
  })

  it('a removed deck stays removed', () => {
    const base = chosen()
    const two = switchDeck(base, { name: 'Atraxa', commander: 'Atraxa', commanderSet: null, decklist: [], precon: null })
    const removed = trackChanges(two, removeDeck(two, base.settings.defaultDeck), new Date(Date.now() + 1000).toISOString())
    expect(converge(removed, two).decks).toEqual([])
  })

  it('applies swaps made on the other device to the decklist', () => {
    const out = DEFAULT_DECKLIST[0].name
    const s = swap('s1', T1, [out], ['Sol Ring'])
    const pc = chosen({ swaps: [s], decklist: applySwap(DEFAULT_DECKLIST, s.out, s.in), stamps: { settings: '', deck: T1 } })
    const phone = chosen({ settings: { ...emptyData().settings, tableIntro: 'Hi' }, stamps: { settings: '', deck: T2 } })
    const merged = converge(phone, pc)
    expect(merged.settings.tableIntro).toBe('Hi')
    expect(merged.swaps).toHaveLength(1)
    expect(merged.decklist.some((e) => e.name === 'Sol Ring')).toBe(true)
    expect(merged.decklist.some((e) => e.name === out)).toBe(false)
  })

  it('takes back a swap that was undone on the other device', () => {
    const out = DEFAULT_DECKLIST[0].name
    const s = swap('s1', T1, [out], ['Sol Ring'])
    const withSwap = chosen({ swaps: [s], decklist: applySwap(DEFAULT_DECKLIST, s.out, s.in), stamps: { settings: '', deck: T3 } })
    const undone = chosen({ deleted: { 'swap:s1': T2 }, stamps: { settings: '', deck: T2 } })
    const merged = converge(withSwap, undone)
    expect(merged.swaps).toEqual([])
    expect(merged.decklist.some((e) => e.name === out)).toBe(true)
  })

  it('never syncs the game in progress', () => {
    const local = chosen({ draft: { startedAt: T1, form: makeGame(), tracker: { turn: 3, power: 0, casts: 0 } } })
    expect(mergeSync(local, chosen()).draft).toBe(local.draft)
    expect(mergeSync(chosen(), local).draft).toBeNull()
  })
})

describe('trackChanges', () => {
  it('remembers deleted games and swaps', () => {
    const game = makeGame({ id: 'g' })
    const prev = chosen({ games: [game], swaps: [swap('s', T1, [], [])] })
    const next = trackChanges(prev, { ...prev, games: [], swaps: [] }, T2)
    expect(next.deleted).toEqual({ 'game:g': T2, 'swap:s': T2 })
  })

  it('stamps settings and deck changes separately', () => {
    const prev = chosen()
    const theme = trackChanges(prev, { ...prev, settings: { ...prev.settings, theme: 'dark' } }, T1)
    expect(theme.stamps).toEqual({ settings: T1, deck: '' })
    const intro = trackChanges(theme, { ...theme, settings: { ...theme.settings, tableIntro: 'Hello' } }, T2)
    expect(intro.stamps).toEqual({ settings: T1, deck: T2 })
  })

  it('leaves untouched data alone', () => {
    const prev = chosen()
    const next = { ...prev, quiz: { q: { box: 1, due: '2026-10-06', seen: 1, wrong: 0, last: '2026-10-05' } } }
    expect(trackChanges(prev, next, T1)).toBe(next)
  })
})
