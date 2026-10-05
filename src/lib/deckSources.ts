// Deck-building sites: most of them don't allow other web apps to read their decks
// (Moxfield and Archidekt block requests from other sites). So a link is recognized
// and the app explains how to copy the list as text instead.

export interface LinkHint {
  /** Site name, null for an unknown link. */
  site: string | null
  steps: string
}

const SITES: { test: RegExp; site: string; steps: string }[] = [
  {
    test: /(^|\.)moxfield\.com$/,
    site: 'Moxfield',
    steps: 'Open the deck on Moxfield, choose Export in the deck menu (⋯), tap “Copy for MTGA” and paste the list here.',
  },
  {
    test: /(^|\.)archidekt\.com$/,
    site: 'Archidekt',
    steps: 'Open the deck on Archidekt, choose Export in the deck menu, copy the text and paste it here.',
  },
  {
    test: /(^|\.)mtggoldfish\.com$/,
    site: 'MTGGoldfish',
    steps: 'Open the deck on MTGGoldfish, choose “Copy to clipboard” (Arena) and paste the list here.',
  },
  {
    test: /(^|\.)edhrec\.com$/,
    site: 'EDHREC',
    steps: 'On the EDHREC page, open “Export” or “Copy decklist” and paste the list here.',
  },
  { test: /(^|\.)tappedout\.net$/, site: 'TappedOut', steps: 'Open the deck on TappedOut, use Export → Text and paste the list here.' },
  { test: /(^|\.)deckstats\.net$/, site: 'Deckstats', steps: 'Open the deck on Deckstats, use Export → Text and paste the list here.' },
]

/** If the pasted text is just a link to a deck site: which site, and how to get the list as text. */
export function linkHint(text: string): LinkHint | null {
  const trimmed = text.trim()
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return null
  let host: string
  try {
    host = new URL(trimmed).hostname.toLowerCase()
  } catch {
    return null
  }
  const known = SITES.find((s) => s.test.test(host))
  return known
    ? { site: known.site, steps: known.steps }
    : { site: null, steps: 'Links can’t be read directly. Export the deck as text on that site and paste the list here.' }
}
