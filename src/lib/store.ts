import { useSyncExternalStore } from 'react'
import { emptyInput, emptyTracker, loadData, mergeImport, saveData } from './data'
import { applySwap } from './decklist'
import { today } from './dates'
import { nextFocus } from './focus'
import type { AppData, DeckEntry, Game, GameInput, LessonId, Settings, SkillId, Swap, Tracker } from './types'

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
      draft: {
        startedAt: new Date().toISOString(),
        form: emptyInput(data.settings, focus),
        tracker: emptyTracker(),
      },
    })
  },

  updateDraft(form: GameInput, tracker?: Tracker) {
    if (!data.draft) return
    commit({ ...data, draft: { ...data.draft, form, tracker: tracker ?? data.draft.tracker } })
  },

  updateTracker(tracker: Tracker) {
    if (!data.draft) return
    commit({ ...data, draft: { ...data.draft, tracker } })
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

  /** Backup einspielen: nichts geht verloren. Gibt die Anzahl neuer/aktualisierter Spiele zurück. */
  importData(imported: AppData): number {
    const { data: merged, changedGames } = mergeImport(data, imported)
    commit(merged)
    requestPersistence()
    return changedGames
  },

  setDecklist(commander: string, decklist: DeckEntry[], commanderSet: string | null = null) {
    commit({ ...data, commander, commanderSet, decklist })
  },

  /** Swap-Runde eintragen: Deckliste anpassen und Tausch protokollieren. */
  addSwap(out: string[], into: string[], note = '', date = today()) {
    const swap: Swap = { id: crypto.randomUUID(), date, out, in: into, note, createdAt: new Date().toISOString() }
    commit({ ...data, decklist: applySwap(data.decklist, out, into), swaps: [...data.swaps, swap] })
  },

  /** Letzte Swap-Runde zurücknehmen (Deckliste wieder zurücktauschen). */
  undoLastSwap() {
    const last = data.swaps.at(-1)
    if (!last) return
    commit({ ...data, decklist: applySwap(data.decklist, last.in, last.out), swaps: data.swaps.slice(0, -1) })
  },

  addTrainingResult(lessonId: LessonId, correct: number, total: number) {
    commit({
      ...data,
      training: [...data.training, { lessonId, correct, total, date: today(), createdAt: new Date().toISOString() }],
    })
  },
}
