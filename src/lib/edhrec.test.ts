import { describe, expect, it } from 'vitest'
import { commanderSlug, fetchCommanderPage, parseSuggestions } from './edhrec'

const view = (name: string, numDecks: number, synergy = 0, potential = 1000) => ({ name, num_decks: numDecks, potential_decks: potential, synergy, url: `/cards/${name}` })

const PAGE = {
  container: {
    json_dict: {
      cardlists: [
        { header: 'Top Cards', tag: 'topcards', cardviews: [view('Sol Ring', 900), view('Rhystic Study', 600, 0.1), view('Opt', 500)] },
        { header: 'Game Changers', tag: 'gamechangers', cardviews: [view('Rhystic Study', 600, 0.1)] },
        { header: 'Instants', tag: 'instants', cardviews: [view('Opt', 500, 0.2), view('Counterspell', 700, 0.3)] },
        { header: 'Creatures', tag: 'creatures', cardviews: [view('Guttersnipe', 400, 0.5), view('Young Pyromancer', 400, 0.6)] },
        { header: 'Broken', tag: 'utilitylands', cardviews: 'nope' },
      ],
    },
  },
}

describe('commanderSlug', () => {
  it('builds EDHREC slugs', () => {
    expect(commanderSlug('Niv-Mizzet, Parun')).toBe('niv-mizzet-parun')
    expect(commanderSlug('Ghalta, Primal Hunger')).toBe('ghalta-primal-hunger')
    expect(commanderSlug('Lim-Dûl the Necromancer')).toBe('lim-dul-the-necromancer')
    expect(commanderSlug("Atraxa, Praetors' Voice")).toBe('atraxa-praetors-voice')
    expect(commanderSlug('Esika, God of the Tree // The Prismatic Bridge')).toBe('esika-god-of-the-tree')
  })
})

describe('parseSuggestions', () => {
  it('lists every card once, most played first, with its kind as group', () => {
    const s = parseSuggestions(PAGE)
    expect(s.map((x) => x.name)).toEqual(['Sol Ring', 'Counterspell', 'Opt', 'Young Pyromancer', 'Guttersnipe'])
    expect(s.find((x) => x.name === 'Opt')).toMatchObject({ group: 'Instants', inclusion: 0.5, synergy: 0.2 })
  })

  it('leaves out Game Changers unless allowed', () => {
    expect(parseSuggestions(PAGE).map((x) => x.name)).not.toContain('Rhystic Study')
    expect(parseSuggestions(PAGE, { gameChangers: true }).map((x) => x.name)).toContain('Rhystic Study')
  })

  it('skips cards already in the deck, ignoring case', () => {
    expect(parseSuggestions(PAGE, { inDeck: ['sol ring', 'Opt'] }).map((x) => x.name)).toEqual(['Counterspell', 'Young Pyromancer', 'Guttersnipe'])
  })

  it('rejects pages without card lists', () => {
    expect(() => parseSuggestions({})).toThrow(/no card lists/)
    expect(() => parseSuggestions(null)).toThrow(/no card lists/)
  })
})

function memoryStorage() {
  const items = new Map<string, string>()
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), items }
}

const respond = (status: number, body: unknown = PAGE) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch

describe('fetchCommanderPage', () => {
  it('asks for the commander’s page and caches only the card lists', async () => {
    const storage = memoryStorage()
    let url = ''
    const page = await fetchCommanderPage('Niv-Mizzet, Parun', (async (u: string) => {
      url = u
      return new Response(JSON.stringify(PAGE))
    }) as typeof fetch, storage)
    expect(url).toBe('https://json.edhrec.com/pages/commanders/niv-mizzet-parun.json')
    expect(parseSuggestions(page)).toHaveLength(5)
    const cached = JSON.parse(storage.items.get('endstep:edhrec') ?? '{}')
    expect(cached.slug).toBe('niv-mizzet-parun')
    expect(JSON.stringify(cached)).not.toContain('/cards/')
    expect(parseSuggestions(cached.page)).toEqual(parseSuggestions(page))
  })

  it('falls back to the cache without a connection', async () => {
    const storage = memoryStorage()
    await fetchCommanderPage('Niv-Mizzet, Parun', respond(200), storage)
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(parseSuggestions(await fetchCommanderPage('Niv-Mizzet, Parun', offline, storage))).toHaveLength(5)
    await expect(fetchCommanderPage('Ghalta, Primal Hunger', offline, storage)).rejects.toThrow(/No connection/)
  })

  it('explains unknown commanders and server errors', async () => {
    await expect(fetchCommanderPage('Nobody', respond(404), null)).rejects.toThrow(/doesn’t know/)
    await expect(fetchCommanderPage('Nobody', respond(500), null)).rejects.toThrow(/responded with 500/)
  })
})
