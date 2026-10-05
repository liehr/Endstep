import { describe, expect, it, vi } from 'vitest'
import { autocomplete, fetchCards, satisfies } from './scryfall'
import { FIXTURE_CARDS } from './scryfall.fixture'

/** Nachgebaute Scryfall-API auf Basis der Testkarten (alle mit Set „fdc“, Basics in „fdn“). */
function fakeApi() {
  const byName = new Map(FIXTURE_CARDS.map((c) => [c.name.toLowerCase(), c]))
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/cards/collection')) {
      const { identifiers } = JSON.parse(String(init?.body)) as {
        identifiers: { name?: string; set?: string; collector_number?: string }[]
      }
      expect(identifiers.length).toBeLessThanOrEqual(75)
      const data = identifiers
        .map((i) => {
          const card = i.name
            ? byName.get(i.name.toLowerCase())
            : FIXTURE_CARDS.find((c) => c.set === i.set && c.collector_number === i.collector_number)
          if (!card) return undefined
          if (i.set && card.set !== i.set) return undefined
          return card
        })
        .filter(Boolean)
      return new Response(JSON.stringify({ data, not_found: [] }))
    }
    const fuzzy = new URL(url).searchParams.get('fuzzy')
    if (fuzzy) {
      const hit = [...byName.values()].find((c) => c.name.toLowerCase().startsWith(fuzzy.toLowerCase()))
      return hit ? new Response(JSON.stringify(hit)) : new Response('{}', { status: 404 })
    }
    return new Response(JSON.stringify({ data: ['Ghalta, Primal Hunger', 'Ghalta and Mavren'] }))
  })
}

describe('fetchCards', () => {
  it('lädt Karten gesammelt und sucht Unbekanntes unscharf nach', async () => {
    const api = fakeApi()
    const { found, notFound } = await fetchCards(['Forest', 'llanowar elves', 'Steel Leaf', 'Gibt es nicht'], api as unknown as typeof fetch, 0)
    expect(found.get('forest')?.name).toBe('Forest')
    expect(found.get('llanowar elves')?.name).toBe('Llanowar Elves')
    expect(found.get('steel leaf')?.name).toBe('Steel Leaf Champion')
    expect(notFound).toEqual(['Gibt es nicht'])
  })

  it('teilt große Decks in Anfragen zu je 75 Karten', async () => {
    const api = fakeApi()
    const names = Array.from({ length: 100 }, (_, i) => (i % 2 ? 'Forest' : 'Sol Ring') + ' '.repeat(i % 2) + `#${i}`)
    await fetchCards(names, api as unknown as typeof fetch, 0).catch(() => {})
    const collectionCalls = api.mock.calls.filter(([url]) => String(url).endsWith('/cards/collection'))
    expect(collectionCalls).toHaveLength(2)
  })
})

describe('autocomplete', () => {
  it('fragt erst ab zwei Zeichen', async () => {
    const api = fakeApi()
    expect(await autocomplete('G', api as unknown as typeof fetch)).toEqual([])
    expect(await autocomplete('Gha', api as unknown as typeof fetch)).toContain('Ghalta, Primal Hunger')
  })
})

describe('Druckversionen', () => {
  it('lädt genau die gewünschte Druckversion (Set und Sammlernummer)', async () => {
    const api = fakeApi()
    const elves = FIXTURE_CARDS.find((c) => c.name === 'Llanowar Elves')!
    const { found } = await fetchCards([{ name: 'Llanowar Elves', set: 'fdc', number: elves.collector_number }], api as unknown as typeof fetch, 0)
    expect(found.get('llanowar elves')).toMatchObject({ set: 'fdc', collectorNumber: elves.collector_number })
    expect(found.get('llanowar elves')?.requestedSet).toBeUndefined()
  })

  it('nimmt die Standardversion, wenn es die Karte im Set nicht gibt, und markiert das', async () => {
    const api = fakeApi()
    // Sol Ring hat in den Testdaten kein Set → gibt es in „fdc“ nicht.
    const { found } = await fetchCards([{ name: 'Sol Ring', set: 'fdc' }], api as unknown as typeof fetch, 0)
    expect(found.get('sol ring')).toMatchObject({ name: 'Sol Ring', requestedSet: 'fdc' })
  })

  it('erkennt, ob eine gespeicherte Karte zur Druckversion passt', () => {
    const card = { set: 'fdc', collectorNumber: '12' } as Parameters<typeof satisfies>[0]
    expect(satisfies(card, { name: 'x' })).toBe(true)
    expect(satisfies(card, { name: 'x', set: 'fdc' })).toBe(true)
    expect(satisfies(card, { name: 'x', set: 'fdc', number: '13' })).toBe(false)
    expect(satisfies(card, { name: 'x', set: 'rix' })).toBe(false)
    expect(satisfies({ ...card!, requestedSet: 'rix' }, { name: 'x', set: 'rix' })).toBe(true)
    expect(satisfies(undefined, { name: 'x' })).toBe(false)
  })
})
