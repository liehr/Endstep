import { useCallback, useEffect, useMemo } from 'react'
import { cardKey, type CardInfo } from './cards'
import { cardCoverage } from './quiz/quiz'
import { ensureCards, satisfies, useCardState, type CardRequest } from './scryfall'
import { useData } from './store'

/** Deckliste plus Kartendaten von Scryfall; lädt Fehlendes automatisch, wenn online. */
export function useDeckCards({ autoLoad = true } = {}) {
  const { decklist, commander, commanderSet } = useData()
  const cardState = useCardState()
  const requests = useMemo<CardRequest[]>(
    () => [{ name: commander, set: commanderSet }, ...decklist.map((e) => ({ name: e.name, set: e.set, number: e.number }))],
    [commander, commanderSet, decklist],
  )
  const lookup = useCallback((name: string): CardInfo | undefined => cardState.cards[cardKey(name)], [cardState.cards])
  const missing = requests.filter((r) => !satisfies(lookup(r.name), r)).map((r) => r.name)
  const unknown = new Set(cardState.notFound.map(cardKey))
  const pending = missing.filter((n) => !unknown.has(cardKey(n)))

  useEffect(() => {
    if (autoLoad && pending.length > 0 && cardState.status === 'idle' && navigator.onLine) void ensureCards(requests)
  }, [autoLoad, pending.length, cardState.status, requests])

  return {
    decklist,
    commander,
    lookup,
    coverage: cardCoverage({ decklist, lookup }),
    missing,
    notFound: cardState.notFound,
    status: cardState.status,
    error: cardState.error,
    commanderSet,
    load: (force = false) => ensureCards(requests, { force }),
  }
}
