import { cardKey } from '../cards'
import { activeDeck, mergeBy, otherDecks, swapsOf } from '../data'
import { applySwap } from '../decklist'
import type { AppData, SavedDeck, Settings, Swap } from '../types'

// Cloud sync merges two copies of the data (this device and the cloud) so that no device
// ever loses progress: lists (games, swaps, lessons, ranks, quiz memory) are united,
// deletions are remembered as tombstones, and the settings and the active deck go to
// whichever device changed them last.

/** Settings that belong to the active deck (they move with it when you switch decks). */
const DECK_SETTINGS = ['defaultDeck', 'defaultBracket', 'tableIntro', 'bracketCheckDone'] as const satisfies readonly (keyof Settings)[]

const deckPart = (d: AppData) => ({
  deckChosen: d.deckChosen,
  precon: d.precon,
  commander: d.commander,
  commanderSet: d.commanderSet,
  decklist: d.decklist,
  ...Object.fromEntries(DECK_SETTINGS.map((k) => [k, d.settings[k]])),
})

const settingsPart = (s: Settings) => Object.fromEntries(Object.entries(s).filter(([k]) => !(DECK_SETTINGS as readonly string[]).includes(k)))

/** JSON with sorted keys, so equal data always gives the same text. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

const same = (a: unknown, b: unknown) => a === b || stableStringify(a) === stableStringify(b)

/** What goes to the cloud: everything except the game in progress, which stays on its device. */
export function syncable(data: AppData): Omit<AppData, 'draft'> {
  const { draft: _draft, ...rest } = data
  return rest
}

export const sameSyncData = (a: AppData, b: AppData) => same(syncable(a), syncable(b))

/**
 * Called on every change made on this device: stamps the parts that changed and remembers
 * deleted games, swaps and decks, so the next sync knows what is newer.
 */
export function trackChanges(prev: AppData, next: AppData, now = new Date().toISOString()): AppData {
  let { deleted, stamps } = next
  const bury = (key: string) => {
    if (deleted === next.deleted) deleted = { ...deleted }
    deleted[key] = now
  }
  if (prev.games !== next.games) {
    const ids = new Set(next.games.map((g) => g.id))
    prev.games.filter((g) => !ids.has(g.id)).forEach((g) => bury(`game:${g.id}`))
  }
  if (prev.swaps !== next.swaps) {
    const ids = new Set(next.swaps.map((s) => s.id))
    prev.swaps.filter((s) => !ids.has(s.id)).forEach((s) => bury(`swap:${s.id}`))
  }
  if (prev.decks !== next.decks) {
    const names = new Set([...next.decks.map((d) => cardKey(d.name)), cardKey(next.settings.defaultDeck)])
    prev.decks.filter((d) => !names.has(cardKey(d.name))).forEach((d) => bury(`deck:${cardKey(d.name)}`))
  }
  if (prev.settings !== next.settings && !same(settingsPart(prev.settings), settingsPart(next.settings))) {
    stamps = { ...stamps, settings: now }
  }
  const deckTouched =
    prev.settings !== next.settings ||
    prev.decklist !== next.decklist ||
    prev.commander !== next.commander ||
    prev.commanderSet !== next.commanderSet ||
    prev.precon !== next.precon ||
    prev.deckChosen !== next.deckChosen
  if (deckTouched && !same(deckPart(prev), deckPart(next))) stamps = { ...stamps, deck: now }
  return deleted === next.deleted && stamps === next.stamps ? next : { ...next, deleted, stamps }
}

/**
 * Of two versions of the same thing, the one with the later `at`. A tie is broken by content,
 * never by which side is local: otherwise two devices would keep overwriting each other.
 */
function later<T>(a: T, b: T, at: (x: T) => string): T {
  const ta = at(a)
  const tb = at(b)
  if (ta !== tb) return tb > ta ? b : a
  return stableStringify(b) > stableStringify(a) ? b : a
}

/** The copy that changed `part` last. A copy with a picked deck beats a fresh one. */
function newer(a: AppData, b: AppData, part: keyof AppData['stamps']): [AppData, AppData] {
  if (a.deckChosen !== b.deckChosen) return a.deckChosen ? [a, b] : [b, a]
  const content = part === 'deck' ? deckPart : (d: AppData) => settingsPart(d.settings)
  const win = later({ d: a, c: content(a) }, { d: b, c: content(b) }, (x) => x.d.stamps[part]).d
  return win === a ? [a, b] : [b, a]
}

/** Unite two lists by key; for the same key `pick` decides. */
function unite<T>(a: T[], b: T[], key: (x: T) => string, pick: (x: T, y: T) => T): T[] {
  const out = new Map<string, T>()
  for (const x of [...a, ...b]) {
    const k = key(x)
    const seen = out.get(k)
    out.set(k, seen === undefined ? x : pick(seen, x))
  }
  return [...out.values()]
}

const byTime = <T>(key: (x: T) => string) => (x: T, y: T) => {
  const a = key(x)
  const b = key(y)
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Bring the winner's decklist in line with the merged swap log: swaps made on the other
 * device are applied, swaps undone on the other device are taken back.
 */
function reconcileDecklist(winner: AppData, swaps: Swap[]) {
  const deck = winner.settings.defaultDeck
  const had = swapsOf(winner.swaps, deck)
  const now = swapsOf(swaps, deck)
  const hadIds = new Set(had.map((s) => s.id))
  const nowIds = new Set(now.map((s) => s.id))
  let decklist = winner.decklist
  for (const s of [...had].reverse()) if (!nowIds.has(s.id)) decklist = applySwap(decklist, s.in, s.out)
  for (const s of now) if (!hadIds.has(s.id)) decklist = applySwap(decklist, s.out, s.in)
  return decklist
}

/**
 * Merge this device's data with the cloud copy. Nothing that exists on either side gets lost
 * unless it was deleted on purpose. The result is the same whichever side is `local`
 * (except the game in progress, which always stays local), so all devices end up equal.
 */
export function mergeSync(local: AppData, remote: AppData): AppData {
  const deleted = { ...local.deleted }
  for (const [key, at] of Object.entries(remote.deleted)) if (!deleted[key] || at > deleted[key]) deleted[key] = at
  const alive = (key: string, at: string) => !(deleted[key] && deleted[key] >= at)

  const [settingsWin] = newer(local, remote, 'settings')
  const [deckWin, deckLose] = newer(local, remote, 'deck')

  const games = unite(local.games, remote.games, (g) => g.id, (a, b) => later(a, b, (g) => g.updatedAt))
    .filter((g) => alive(`game:${g.id}`, g.updatedAt))
    .sort(byTime((g) => `${g.createdAt}|${g.id}`))
  // A swap only changes when its deck is renamed, which also makes that device the deck winner.
  const swaps = mergeBy(deckWin.swaps, deckLose.swaps, (s) => s.id)
    .filter((s) => alive(`swap:${s.id}`, s.createdAt))
    .sort(byTime((s) => `${s.createdAt}|${s.id}`))
  const training = mergeBy(local.training, remote.training, (t) => `${t.lessonId}|${t.createdAt}`).sort(
    byTime((t) => `${t.createdAt}|${t.lessonId}`),
  )
  // Passed the same exam on two devices: the first pass counts.
  const promotions = unite(local.promotions, remote.promotions, (p) => String(p.rank), (a, b) =>
    later(a, b, (p) => p.createdAt) === a ? b : a,
  ).sort((a, b) => a.rank - b.rank)
  const quiz = { ...local.quiz }
  for (const [key, stat] of Object.entries(remote.quiz)) {
    quiz[key] = quiz[key] ? later(quiz[key], stat, (q) => `${q.last}|${String(q.at ?? 0).padStart(15, '0')}`) : stat
  }
  const settings: Settings = { ...settingsWin.settings }
  for (const k of DECK_SETTINGS) Object.assign(settings, { [k]: deckWin.settings[k] })

  // The deck the other device was playing joins "Your decks" (unless it's the same deck).
  const loserActive: SavedDeck[] = deckLose.deckChosen
    ? [{ ...activeDeck(deckLose), ...(deckLose.stamps.deck ? { savedAt: deckLose.stamps.deck } : {}) }]
    : []
  const newest = new Map<string, SavedDeck>()
  for (const d of [...local.decks, ...remote.decks, ...loserActive]) {
    const key = cardKey(d.name)
    if (!alive(`deck:${key}`, d.savedAt ?? '')) continue
    const seen = newest.get(key)
    newest.set(key, seen ? later(seen, d, (x) => x.savedAt ?? '') : d)
  }
  const decks = otherDecks(
    [...newest.values()].sort(byTime((d) => `${d.savedAt ?? ''}|${cardKey(d.name)}`)),
    settings.defaultDeck,
  )

  return {
    schemaVersion: 1,
    games,
    settings,
    draft: local.draft,
    deckChosen: deckWin.deckChosen,
    precon: deckWin.precon,
    commander: deckWin.commander,
    commanderSet: deckWin.commanderSet,
    decklist: reconcileDecklist(deckWin, swaps),
    swaps,
    decks,
    training,
    quiz,
    promotions,
    deleted,
    stamps: {
      settings: local.stamps.settings > remote.stamps.settings ? local.stamps.settings : remote.stamps.settings,
      deck: local.stamps.deck > remote.stamps.deck ? local.stamps.deck : remote.stamps.deck,
    },
  }
}
