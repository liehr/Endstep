import { describe, expect, it } from 'vitest'
import { applySwap, DEFAULT_DECKLIST, deckCardNames, deckSize, parseDecklist, serializeDecklist } from './decklist'

describe('Standard-Deckliste', () => {
  it('hat 99 Karten (plus Commander) und 32 Wälder', () => {
    expect(deckSize(DEFAULT_DECKLIST)).toBe(99)
    expect(DEFAULT_DECKLIST.find((e) => e.name === 'Forest')?.qty).toBe(32)
  })
})

describe('parseDecklist', () => {
  it('versteht Moxfield-/Arena-Formate mit Abschnitten, Sets und Foil-Markierungen', () => {
    const text = `Commander
1 Ghalta, Primal Hunger (RIX) 130

Deck
1x Llanowar Elves (FDN) 227 *F*
2 Forest
Sol Ring
Creatures (2)
1 Steel Leaf Champion [Ramp]
// Kommentar
Sideboard
1 Blightsteel Colossus`
    const parsed = parseDecklist(text)
    expect(parsed.commander).toBe('Ghalta, Primal Hunger')
    expect(parsed.commanderSet).toBe('rix')
    expect(parsed.entries).toEqual([
      { name: 'Llanowar Elves', qty: 1, set: 'fdn', number: '227' },
      { name: 'Forest', qty: 2 },
      { name: 'Sol Ring', qty: 1 },
      { name: 'Steel Leaf Champion', qty: 1 },
    ])
    expect(parsed.errors).toEqual([])
  })

  it('verwechselt „Commander’s Sphere“ nicht mit einer Überschrift', () => {
    expect(parseDecklist("Commander's Sphere").entries).toEqual([{ name: "Commander's Sphere", qty: 1 }])
  })

  it('fasst doppelte Einträge zusammen', () => {
    expect(parseDecklist('1 Forest\n3 forest').entries).toEqual([{ name: 'Forest', qty: 4 }])
  })

  it('lässt sich mit Druckversionen wieder einlesen', () => {
    const text = serializeDecklist('Ghalta, Primal Hunger', DEFAULT_DECKLIST, 'fdc')
    expect(text).toContain('1 Ghalta, Primal Hunger (FDC)')
    expect(text).toContain('32 Forest (FDC)')
    const parsed = parseDecklist(text)
    expect(parsed).toMatchObject({ commander: 'Ghalta, Primal Hunger', commanderSet: 'fdc' })
    expect(parsed.entries).toEqual(DEFAULT_DECKLIST)
  })

  it('setzt die Precon-Karten auf das Set FDC', () => {
    expect(DEFAULT_DECKLIST.every((e) => e.set === 'fdc')).toBe(true)
  })
})

describe('applySwap', () => {
  it('nimmt Karten raus und neue rein, Kartenzahl bleibt gleich', () => {
    const next = applySwap(DEFAULT_DECKLIST, ['Colossal Majesty', 'forest'], ['Heroic Intervention', 'Return of the Wildspeaker'])
    expect(deckSize(next)).toBe(99)
    expect(next.find((e) => e.name === 'Colossal Majesty')).toBeUndefined()
    expect(next.find((e) => e.name === 'Forest')?.qty).toBe(31)
    expect(next.find((e) => e.name === 'Heroic Intervention')?.qty).toBe(1)
  })

  it('ist mit vertauschten Listen umkehrbar', () => {
    const swapped = applySwap(DEFAULT_DECKLIST, ['Harmonize'], ['Heroic Intervention'])
    const back = applySwap(swapped, ['Heroic Intervention'], ['Harmonize'])
    expect(deckSize(back)).toBe(99)
    expect(back.find((e) => e.name === 'Harmonize')?.qty).toBe(1)
  })
})

describe('deckCardNames', () => {
  it('lässt Basic Lands weg', () => {
    const names = deckCardNames(DEFAULT_DECKLIST)
    expect(names).not.toContain('Forest')
    expect(names).toContain('Sol Ring')
  })
})
