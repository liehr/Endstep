import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from './backup'
import { defaultSettings, emptyData, loadData, mergeGames, sanitizeData, STORAGE_KEY } from './data'
import { makeGame } from './test-utils'

const memoryStorage = (value: string | null) => ({ getItem: (key: string) => (key === STORAGE_KEY ? value : null) })

describe('loadData', () => {
  it('liefert leere Daten, wenn nichts gespeichert ist', () => {
    expect(loadData(memoryStorage(null))).toEqual(emptyData())
  })

  it('übersteht kaputtes JSON', () => {
    expect(loadData(memoryStorage('{kaputt'))).toEqual(emptyData())
  })

  it('liest gespeicherte Spiele wieder ein', () => {
    const game = makeGame({ result: 'win', deadCards: ['Beast Within'] })
    const data = { ...emptyData(), games: [game] }
    expect(loadData(memoryStorage(JSON.stringify(data))).games).toEqual([game])
  })
})

describe('sanitizeData', () => {
  it('verwirft Spiele ohne ID und repariert ungültige Felder', () => {
    const data = sanitizeData({
      games: [
        { result: 'win' },
        { id: 'x', result: 'unentschieden', focus: 'quatsch', bracket: 9, mulligans: -1, deadCards: ['A', 3, ' '] },
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
  it('behält bei gleicher ID die zuletzt geänderte Version', () => {
    const old = makeGame({ id: 'a', notes: 'alt', updatedAt: '2026-10-01T10:00:00Z' })
    const updated = { ...old, notes: 'neu', updatedAt: '2026-10-02T10:00:00Z' }
    const other = makeGame({ id: 'b' })
    expect(mergeGames([updated], [old, other])).toEqual([updated, other])
    expect(mergeGames([old], [updated])).toEqual([updated])
  })
})

describe('Backup', () => {
  it('lässt sich exportieren und wieder einlesen (ohne laufende Runde)', () => {
    const data = { ...emptyData(), games: [makeGame()], draft: { startedAt: 'x', form: makeGame() } }
    const restored = parseBackup(createBackup(data, '1.0.0'))
    expect(restored.games).toEqual(data.games)
    expect(restored.draft).toBeNull()
  })

  it('lehnt fremde Dateien mit verständlicher Meldung ab', () => {
    expect(() => parseBackup('nope')).toThrow('kein JSON')
    expect(() => parseBackup('{"foo": 1}')).toThrow('kein Endstep-Backup')
  })
})
