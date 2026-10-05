import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from './backup'
import { DEFAULT_DECK, DEFAULT_TABLE_INTRO } from './content'
import {
  activeDeck,
  applySettings,
  deckNameTaken,
  defaultSettings,
  emptyData,
  loadData,
  mergeGames,
  mergeImport,
  removeDeck,
  sanitizeData,
  STORAGE_KEY,
  swapsOf,
  switchDeck,
  type ChosenDeck,
} from './data'
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
    const backup = { ...emptyData(), deckChosen: true, decklist: [{ name: 'Forest', qty: 99 }], swaps: [{ id: 's', deck: DEFAULT_DECK, date: '2026-10-01', out: [], in: [], note: '', createdAt: 'x' }] }
    const { data } = mergeImport(emptyData(), backup)
    expect(data.decklist).toEqual([{ name: 'Forest', qty: 99 }])
    expect(data.swaps).toHaveLength(1)
  })

  it('keeps a custom decklist and merges swaps without duplicates', () => {
    const swap = { id: 's', deck: DEFAULT_DECK, date: '2026-10-01', out: [], in: [], note: '', createdAt: 'x' }
    const current = { ...emptyData(), decklist: [{ name: 'Forest', qty: 98 }, { name: 'Sol Ring', qty: 1 }], swaps: [swap] }
    const backup = { ...emptyData(), decklist: [{ name: 'Forest', qty: 99 }], swaps: [swap] }
    const { data } = mergeImport(current, backup)
    expect(data.decklist).toEqual(current.decklist)
    expect(data.swaps).toHaveLength(1)
  })
})

describe('question memory', () => {
  const stat = (last: string, box = 1) => ({ box, due: last, seen: 1, wrong: 0, last })

  it('older data loads with an empty memory, invalid entries are dropped', () => {
    expect(sanitizeData({ games: [] }).quiz).toEqual({})
    const quiz = sanitizeData({ quiz: { ok: stat('2026-10-05'), badBox: { ...stat('2026-10-05'), box: 9 }, badDate: { ...stat('x') }, list: [] } }).quiz
    expect(Object.keys(quiz)).toEqual(['ok'])
  })

  it('restoring a backup keeps the more recently answered state per question', () => {
    const current = { ...emptyData(), quiz: { a: stat('2026-10-05', 3), b: stat('2026-10-01') } }
    const imported = { ...emptyData(), quiz: { a: stat('2026-10-02', 0), b: stat('2026-10-04', 2), c: stat('2026-10-03') } }
    const { quiz } = mergeImport(current, imported).data
    expect(quiz.a.box).toBe(3)
    expect(quiz.b.box).toBe(2)
    expect(quiz.c).toBeDefined()
  })
})

describe('picking a deck', () => {
  const sliver: ChosenDeck = {
    name: 'Sliver Swarm (Sliver Gravemother)',
    commander: 'The First Sliver',
    commanderSet: 'clb',
    decklist: [{ name: 'Sol Ring', qty: 1 }],
    precon: 'SliverSwarm_CMM',
  }
  const swap = (deck: string) => ({ id: deck, deck, date: '2026-10-01', out: ['A'], in: ['B'], note: '', createdAt: 'x' })

  it('starts without a deck, older data counts as having picked the Ghalta deck', () => {
    expect(emptyData().deckChosen).toBe(false)
    expect(sanitizeData({ games: [] }).deckChosen).toBe(false)
    const legacy = sanitizeData({ commander: 'Ghalta, Primal Hunger', swaps: [{ id: 's', date: '2026-10-01' }] })
    expect(legacy).toMatchObject({ deckChosen: true, precon: 'TramplesaurusRex_FDC' })
    expect(legacy.swaps[0].deck).toBe(DEFAULT_DECK)
    expect(sanitizeData({ commander: 'Atraxa, Praetors\' Voice' }).precon).toBeNull()
    // Once saved, the stored flag wins (the stand-in Ghalta deck has a commander too).
    expect(sanitizeData(JSON.parse(JSON.stringify(emptyData()))).deckChosen).toBe(false)
  })

  it('switches deck, name and table talk; games and swaps stay', () => {
    const before = { ...emptyData(), deckChosen: true, games: [makeGame()], swaps: [swap(DEFAULT_DECK)] }
    const after = switchDeck(before, sliver)
    expect(after).toMatchObject({ deckChosen: true, commander: 'The First Sliver', precon: 'SliverSwarm_CMM' })
    expect(after.settings.defaultDeck).toBe(sliver.name)
    expect(after.settings.tableIntro).toBe('Sliver Swarm (Sliver Gravemother) precon, unchanged, Bracket 2.')
    expect(after.games).toEqual(before.games)
    expect(swapsOf(after.swaps, sliver.name)).toEqual([])
    expect(swapsOf(after.swaps, DEFAULT_DECK)).toHaveLength(1)
  })

  it('keeps a table talk you wrote yourself and resets the bracket check for a new deck', () => {
    const own = { ...emptyData(), deckChosen: true, settings: { ...defaultSettings(), tableIntro: 'Hi all!', bracketCheckDone: true } }
    const after = switchDeck(own, { ...sliver, precon: null })
    expect(after.settings.tableIntro).toBe('Hi all!')
    expect(after.settings.bracketCheckDone).toBe(false)
    const fresh = switchDeck(emptyData(), { ...sliver, precon: null })
    expect(fresh.settings.tableIntro).toBe('The First Sliver deck, Bracket 2.')
    expect(emptyData().settings.tableIntro).toBe(DEFAULT_TABLE_INTRO)
  })

  it('renaming the deck takes its swaps along', () => {
    const data = { ...emptyData(), swaps: [swap(DEFAULT_DECK), swap('Other')] }
    const renamed = applySettings(data, { ...data.settings, defaultDeck: 'Dino Stomp' })
    expect(renamed.swaps.map((s) => s.deck)).toEqual(['Dino Stomp', 'Other'])
  })

  it('restoring a backup before picking a deck takes deck and settings from the backup', () => {
    const backup = switchDeck({ ...emptyData(), settings: { ...defaultSettings(), defaultPlayers: 5 } }, sliver)
    const { data } = mergeImport(emptyData(), backup)
    expect(data).toMatchObject({ deckChosen: true, commander: 'The First Sliver', precon: 'SliverSwarm_CMM' })
    expect(data.settings.defaultPlayers).toBe(5)
  })

  it('keeps the deck you leave and brings it back as you left it', () => {
    const swapped = [{ name: 'Forest', qty: 98 }, { name: 'Sol Ring', qty: 1 }]
    const ghalta = { ...emptyData(), deckChosen: true, decklist: swapped, settings: { ...defaultSettings(), defaultBracket: 3 as const, bracketCheckDone: true, tableIntro: 'Stomp!' } }
    const onSliver = switchDeck(ghalta, sliver)
    expect(onSliver.decks).toEqual([activeDeck(ghalta)])
    expect(onSliver.decks[0]).toMatchObject({ name: DEFAULT_DECK, bracket: 3, bracketCheckDone: true, tableIntro: 'Stomp!' })

    const back = switchDeck({ ...onSliver, settings: { ...onSliver.settings, defaultBracket: 1 } }, onSliver.decks[0])
    expect(back).toMatchObject({ commander: 'Ghalta, Primal Hunger', decklist: swapped })
    expect(back.settings).toMatchObject({ defaultDeck: DEFAULT_DECK, defaultBracket: 3, bracketCheckDone: true, tableIntro: 'Stomp!' })
    expect(back.decks.map((d) => [d.name, d.bracket])).toEqual([[sliver.name, 1]])
  })

  it('lists each deck once and never the active one', () => {
    const start = switchDeck({ ...emptyData(), deckChosen: true }, sliver)
    const again = switchDeck(start, { ...sliver, decklist: [{ name: 'Island', qty: 99 }] })
    expect(again.decks.map((d) => d.name)).toEqual([DEFAULT_DECK])
    // Before a deck is picked, the stand-in Ghalta deck isn't kept.
    expect(switchDeck(emptyData(), sliver).decks).toEqual([])
    expect(deckNameTaken(again, DEFAULT_DECK.toUpperCase())).toBe(true)
    expect(deckNameTaken(again, sliver.name)).toBe(false)
    expect(removeDeck(again, DEFAULT_DECK).decks).toEqual([])
  })

  it('loads saved decks safely: older data has none, broken entries and duplicates are dropped', () => {
    expect(sanitizeData({ games: [] }).decks).toEqual([])
    const saved = { name: 'Slivers', commander: 'The First Sliver', decklist: [{ name: 'Sol Ring', qty: 1 }], bracket: 9, precon: 'bad name!' }
    const data = sanitizeData({
      settings: { defaultDeck: 'Active' },
      decks: [saved, { ...saved, name: 'slivers' }, { name: 'No list', commander: 'X' }, { ...saved, name: 'Active' }, 'junk'],
    })
    expect(data.decks).toHaveLength(1)
    expect(data.decks[0]).toMatchObject({ name: 'Slivers', bracket: 2, precon: null, commanderSet: null, bracketCheckDone: false })
    expect(sanitizeData(JSON.parse(JSON.stringify(data))).decks).toEqual(data.decks)
  })

  it('restoring a backup adds its decks to yours', () => {
    const phone = switchDeck(switchDeck({ ...emptyData(), deckChosen: true }, sliver), { ...sliver, name: 'Elves', commander: 'Lathril, Blade of the Elves', precon: null })
    const mine = switchDeck({ ...emptyData(), deckChosen: true }, { ...sliver, name: 'Dragons', commander: 'Lathliss, Dragon Queen', precon: null })
    const { data } = mergeImport(mine, phone)
    expect(data.settings.defaultDeck).toBe('Dragons')
    expect(data.decks.map((d) => d.name).sort()).toEqual([DEFAULT_DECK, 'Elves', sliver.name].sort())
  })
})
