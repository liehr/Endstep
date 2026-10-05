import { describe, expect, it } from 'vitest'
import { fetchPreconDeck, parsePreconDeck, PRECONS, searchPrecons } from './precons'

// Shortened MTGJSON deck file (only the fields we read).
const deckFile = {
  data: {
    name: 'Heads I Win, Tails You Lose',
    commander: [
      { name: 'Zndrsplt, Eye of Wisdom // Zndrsplt, Eye of Wisdom', count: 1, setCode: 'SLD', number: '379' },
      { name: 'Okaun, Eye of Chaos // Okaun, Eye of Chaos', count: 1, setCode: 'SLD', number: '380' },
    ],
    mainBoard: [
      { name: 'Sol Ring', count: 1, setCode: 'SLD', number: '1011' },
      { name: 'Island', count: 10, setCode: 'SLD', number: '63' },
      { name: 'Island', count: 5, setCode: 'SLD', number: '64' },
      { name: 'Delver of Secrets // Insectile Aberration', count: 1, setCode: 'ISD', number: '51', side: 'a' },
      { name: 'Delver of Secrets // Insectile Aberration', count: 1, setCode: 'ISD', number: '51', side: 'b' },
    ],
  },
}

describe('precon index', () => {
  it('contains the Commander precons, newest first', () => {
    expect(PRECONS.length).toBeGreaterThan(150)
    expect(PRECONS.find((p) => p.file === 'TramplesaurusRex_FDC')?.commanders).toEqual(['Ghalta, Primal Hunger'])
    const dates = PRECONS.map((p) => p.released)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('finds decks by name, commander, set and year, ignoring case and punctuation', () => {
    expect(searchPrecons('tramplesaurus')[0].file).toBe('TramplesaurusRex_FDC')
    expect(searchPrecons('ghalta').map((p) => p.file)).toContain('TramplesaurusRex_FDC')
    expect(searchPrecons('velociramp')[0].file).toBe('VelociRampTor_LCC')
    expect(searchPrecons('fdc 2026').every((p) => p.set === 'fdc')).toBe(true)
    expect(searchPrecons('zzzz nothing')).toEqual([])
    expect(searchPrecons('')).toHaveLength(30)
  })

  it('ranks decks whose name or commander starts with the query first', () => {
    const results = searchPrecons('ghalta')
    expect(results[0].commanders[0]).toMatch(/^Ghalta/)
  })
})

describe('parsePreconDeck', () => {
  it('reads commander, printings and quantities; partners go into the 99', () => {
    const deck = parsePreconDeck(deckFile)
    expect(deck.commander).toBe('Zndrsplt, Eye of Wisdom')
    expect(deck.commanderSet).toBe('sld')
    expect(deck.entries).toEqual([
      { name: 'Okaun, Eye of Chaos', qty: 1, set: 'sld', number: '380' },
      { name: 'Sol Ring', qty: 1, set: 'sld', number: '1011' },
      { name: 'Island', qty: 15, set: 'sld', number: '63' },
      { name: 'Delver of Secrets // Insectile Aberration', qty: 1, set: 'isd', number: '51' },
    ])
  })

  it('rejects files without a commander', () => {
    expect(() => parsePreconDeck({ data: { mainBoard: [] } })).toThrow('no commander')
    expect(() => parsePreconDeck(null)).toThrow('no commander')
  })

  it('loads the deck file from MTGJSON', async () => {
    const urls: string[] = []
    const fetchImpl = (async (url: string) => {
      urls.push(url)
      return new Response(JSON.stringify(deckFile))
    }) as typeof fetch
    const deck = await fetchPreconDeck('HeadsIWinTailsYouLose_SLD', fetchImpl)
    expect(urls).toEqual(['https://mtgjson.com/api/v5/decks/HeadsIWinTailsYouLose_SLD.json'])
    expect(deck.entries).toHaveLength(4)
    await expect(fetchPreconDeck('../evil', fetchImpl)).rejects.toThrow('Unknown precon')
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    await expect(fetchPreconDeck('X_Y', offline)).rejects.toThrow('No connection')
  })
})
