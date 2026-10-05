import { describe, expect, it } from 'vitest'
import { linkHint } from './deckSources'

describe('linkHint', () => {
  it('recognizes deck site links and explains the text export', () => {
    expect(linkHint('https://www.moxfield.com/decks/abc123')?.site).toBe('Moxfield')
    expect(linkHint('  https://archidekt.com/decks/123/ghalta  ')?.site).toBe('Archidekt')
    expect(linkHint('https://example.com/deck')).toMatchObject({ site: null })
  })

  it('leaves decklists alone', () => {
    expect(linkHint('1 Sol Ring\n1 Forest')).toBeNull()
    expect(linkHint('Commander\nhttps://moxfield.com/decks/x')).toBeNull()
  })
})
