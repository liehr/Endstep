import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from './backup'
import { defaultSettings, emptyData, loadData, mergeGames, mergeImport, sanitizeData, STORAGE_KEY } from './data'
import { makeGame } from './test-utils'

const memoryStorage = (value: string | null) => ({ getItem: (key: string) => (key === STORAGE_KEY ? value : null) })

describe('loadData', () => {
  it('returns empty data when nothing is stored', () => {
    expect(loadData(memoryStorage(null))).toEqual(emptyData())
  })

  it('survives broken JSON', () => {
    expect(loadData(memoryStorage('{broken'))).toEqual(emptyData())
  })

  it('reads stored games back in', () => {
    const game = makeGame({ result: 'win', deadCards: ['Beast Within'] })
    const data = { ...emptyData(), games: [game] }
    expect(loadData(memoryStorage(JSON.stringify(data))).games).toEqual([game])
  })
})

describe('sanitizeData', () => {
  it('drops games without an ID and repairs invalid fields', () => {
    const data = sanitizeData({
      games: [
        { result: 'win' },
        { id: 'x', result: 'draw', focus: 'nonsense', bracket: 9, mulligans: -1, deadCards: ['A', 3, ' '] },
      ],
    })
    expect(data.games).toHaveLength(1)
    expect(data.games[0]).toMatchObject({
      id: 'x',
      result: 'loss',
      focus: 'mulligan',
      bracket: defaultSettings().defaultBracket,
      mulligans: null,
      deadCards: ['A'],
    })
  })
})

describe('mergeGames', () => {
  it('keeps the most recently changed version for the same ID', () => {
    const old = makeGame({ id: 'a', notes: 'old', updatedAt: '2026-10-01T10:00:00Z' })
    const updated = { ...old, notes: 'new', updatedAt: '2026-10-02T10:00:00Z' }
    const other = makeGame({ id: 'b' })
    expect(mergeGames([updated], [old, other])).toEqual([updated, other])
    expect(mergeGames([old], [updated])).toEqual([updated])
  })
})

describe('Backup', () => {
  it('can be exported and read back in (without the game in progress)', () => {
    const data = { ...emptyData(), games: [makeGame()], draft: { startedAt: 'x', form: makeGame(), tracker: { turn: 1, power: 0, casts: 0 } } }
    const restored = parseBackup(createBackup(data, '1.0.0'))
    expect(restored.games).toEqual(data.games)
    expect(restored.draft).toBeNull()
  })

  it('rejects foreign files with a clear message', () => {
    expect(() => parseBackup('nope')).toThrow('not JSON')
    expect(() => parseBackup('{"foo": 1}')).toThrow('not an Endstep backup')
  })
})

describe('new fields (deck, swaps, training, counters)', () => {
  it('fills older data without these fields with defaults', () => {
    const legacy = { games: [makeGame()], settings: {}, draft: { startedAt: 'x', form: {} } }
    const data = sanitizeData(legacy)
    expect(data.decklist.reduce((n, e) => n + e.qty, 0)).toBe(99)
    expect(data.commander).toBe('Ghalta, Primal Hunger')
    expect(data.swaps).toEqual([])
    expect(data.draft?.tracker).toEqual({ turn: 1, power: 0, casts: 0 })
    expect(data.games[0].turns).toBeNull()
    expect(data.settings.bracketCheckDone).toBe(false)
    expect(sanitizeData({ settings: { bracketCheckDone: true } }).settings.bracketCheckDone).toBe(true)
  })

  it('drops invalid swaps and training results', () => {
    const data = sanitizeData({
      swaps: [{ id: 's1', date: '2026-10-08', out: ['A'], in: ['B'] }, { id: 's2', date: 'yesterday' }],
      training: [{ lessonId: 'ghalta', correct: 4, total: 5 }, { lessonId: 'nonsense', correct: 1, total: 1 }, { lessonId: 'rules', correct: 6, total: 5 }],
    })
    expect(data.swaps.map((s) => s.id)).toEqual(['s1'])
    expect(data.training).toHaveLength(1)
  })
})

describe('mergeImport', () => {
  it('takes the decklist from the backup if the default list is still here', () => {
    const backup = { ...emptyData(), decklist: [{ name: 'Forest', qty: 99 }], swaps: [{ id: 's', date: '2026-10-01', out: [], in: [], note: '', createdAt: 'x' }] }
    const { data } = mergeImport(emptyData(), backup)
    expect(data.decklist).toEqual([{ name: 'Forest', qty: 99 }])
    expect(data.swaps).toHaveLength(1)
  })

  it('keeps a custom decklist and merges swaps without duplicates', () => {
    const swap = { id: 's', date: '2026-10-01', out: [], in: [], note: '', createdAt: 'x' }
    const current = { ...emptyData(), decklist: [{ name: 'Forest', qty: 98 }, { name: 'Sol Ring', qty: 1 }], swaps: [swap] }
    const backup = { ...emptyData(), decklist: [{ name: 'Forest', qty: 99 }], swaps: [swap] }
    const { data } = mergeImport(current, backup)
    expect(data.decklist).toEqual(current.decklist)
    expect(data.swaps).toHaveLength(1)
  })
})
