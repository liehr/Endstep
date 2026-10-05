import { useSyncExternalStore } from 'react'
import { emptyInput, loadData, mergeGames, saveData } from './data'
import { nextFocus } from './focus'
import type { AppData, Game, GameInput, Settings, SkillId } from './types'

// Ein kleiner globaler Speicher: Daten liegen nur auf dem Gerät (localStorage).

let data: AppData = loadData(localStorage)
const listeners = new Set<() => void>()

function commit(next: AppData) {
  data = next
  try {
    saveData(localStorage, data)
  } catch (err) {
    console.error('Speichern fehlgeschlagen', err)
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, () => data)
}

/** Browser bitten, die Daten dauerhaft zu behalten (nicht bei Speicherknappheit zu löschen). */
function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {})
}

export const actions = {
  startDraft(focus: SkillId = nextFocus(data.games)) {
    commit({
      ...data,
      draft: { startedAt: new Date().toISOString(), form: emptyInput(data.settings, focus) },
    })
  },

  updateDraft(form: GameInput) {
    if (!data.draft) return
    commit({ ...data, draft: { ...data.draft, form } })
  },

  discardDraft() {
    commit({ ...data, draft: null })
  },

  /** Laufende Runde als Spiel speichern. Gibt die neue ID zurück. */
  finishDraft(form: GameInput): string {
    const now = new Date().toISOString()
    const game: Game = { ...form, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    commit({ ...data, games: [...data.games, game], draft: null })
    requestPersistence()
    return game.id
  },

  updateGame(id: string, form: GameInput) {
    commit({
      ...data,
      games: data.games.map((g) =>
        g.id === id ? { ...g, ...form, updatedAt: new Date().toISOString() } : g,
      ),
    })
  },

  deleteGame(id: string) {
    commit({ ...data, games: data.games.filter((g) => g.id !== id) })
  },

  updateSettings(settings: Settings) {
    commit({ ...data, settings })
  },

  /** Backup einspielen: Spiele werden zusammengeführt, nichts geht verloren. Gibt die Anzahl neuer/aktualisierter Spiele zurück. */
  importData(imported: AppData): number {
    const merged = mergeGames(data.games, imported.games)
    const before = new Map(data.games.map((g) => [g.id, g.updatedAt]))
    const changed = merged.filter((g) => before.get(g.id) !== g.updatedAt).length
    commit({ ...data, games: merged })
    requestPersistence()
    return changed
  },
}
