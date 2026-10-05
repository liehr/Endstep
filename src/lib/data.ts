import { DEFAULT_DECK, DEFAULT_TABLE_INTRO, SKILLS, WHY_CATEGORIES, WIPE_OPTIONS } from './content'
import { today } from './dates'
import { DEFAULT_COMMANDER, DEFAULT_DECKLIST, DEFAULT_SET, sameDecklist } from './decklist'
import type {
  AppData,
  Bracket,
  DeckEntry,
  Draft,
  FocusRating,
  Game,
  GameInput,
  Result,
  Settings,
  SkillId,
  Swap,
  Tracker,
  TrainingResult,
  WhyCategory,
  WipeOutcome,
} from './types'

export const STORAGE_KEY = 'endstep:data'

export function defaultSettings(): Settings {
  return {
    defaultDeck: DEFAULT_DECK,
    defaultBracket: 2,
    defaultPlayers: 4,
    tableIntro: DEFAULT_TABLE_INTRO,
    bracketCheckDone: false,
  }
}

export function emptyData(): AppData {
  return {
    schemaVersion: 1,
    games: [],
    settings: defaultSettings(),
    draft: null,
    commander: DEFAULT_COMMANDER,
    commanderSet: DEFAULT_SET,
    decklist: DEFAULT_DECKLIST.map((e) => ({ ...e })),
    swaps: [],
    training: [],
  }
}

export const emptyTracker = (): Tracker => ({ turn: 1, power: 0, casts: 0 })

export function emptyInput(settings: Settings, focus: SkillId): GameInput {
  return {
    playedAt: today(),
    deck: settings.defaultDeck,
    bracket: settings.defaultBracket,
    players: settings.defaultPlayers,
    focus,
    focusRating: null,
    result: 'loss',
    winner: '',
    whyWinner: '',
    whyCategory: null,
    decision: '',
    decisionSkill: null,
    deadCards: [],
    starCards: [],
    ghaltaTurn: null,
    turns: null,
    mulligans: null,
    wipe: null,
    feedback: '',
    notes: '',
  }
}

// --- Validierung -----------------------------------------------------------
// Daten kommen aus localStorage oder aus importierten Backups und können
// von älteren Versionen stammen oder beschädigt sein. Alles wird deshalb
// feldweise geprüft und auf sichere Standardwerte zurückgesetzt.

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

function oneOf<T>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

function intOrNull(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null
}

const strList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
    : []

const SKILL_IDS = SKILLS.map((s) => s.id)
const WHY_IDS = WHY_CATEGORIES.map((c) => c.id)
const WIPE_IDS = WIPE_OPTIONS.map((o) => o.id)
const BRACKETS: Bracket[] = [1, 2, 3, 4, 5]
const RATINGS: FocusRating[] = [1, 2, 3]
const RESULTS: Result[] = ['win', 'loss']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SET_RE = /^[a-z0-9]{2,6}$/

export function sanitizeInput(raw: Obj, settings: Settings): GameInput {
  return {
    playedAt: DATE_RE.test(str(raw.playedAt)) ? str(raw.playedAt) : today(),
    deck: str(raw.deck).trim() || settings.defaultDeck,
    bracket: oneOf(raw.bracket, BRACKETS, settings.defaultBracket),
    players: intOrNull(raw.players, 2, 8) ?? settings.defaultPlayers,
    focus: oneOf<SkillId>(raw.focus, SKILL_IDS, SKILL_IDS[0]),
    focusRating: oneOf<FocusRating | null>(raw.focusRating, RATINGS, null),
    result: oneOf(raw.result, RESULTS, 'loss'),
    winner: str(raw.winner),
    whyWinner: str(raw.whyWinner),
    whyCategory: oneOf<WhyCategory | null>(raw.whyCategory, WHY_IDS, null),
    decision: str(raw.decision),
    decisionSkill: oneOf<SkillId | null>(raw.decisionSkill, SKILL_IDS, null),
    deadCards: strList(raw.deadCards),
    starCards: strList(raw.starCards),
    ghaltaTurn: intOrNull(raw.ghaltaTurn, 1, 99),
    turns: intOrNull(raw.turns, 1, 99),
    mulligans: intOrNull(raw.mulligans, 0, 7),
    wipe: oneOf<WipeOutcome | null>(raw.wipe, WIPE_IDS, null),
    feedback: str(raw.feedback),
    notes: str(raw.notes),
  }
}

export function sanitizeGame(raw: unknown, settings: Settings): Game | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || raw.id === '') return null
  const now = new Date().toISOString()
  const createdAt = str(raw.createdAt, now)
  return {
    id: raw.id,
    ...sanitizeInput(raw, settings),
    createdAt,
    updatedAt: str(raw.updatedAt, createdAt),
  }
}

function sanitizeSettings(raw: unknown): Settings {
  const defaults = defaultSettings()
  if (!isObj(raw)) return defaults
  return {
    defaultDeck: str(raw.defaultDeck).trim() || defaults.defaultDeck,
    defaultBracket: oneOf(raw.defaultBracket, BRACKETS, defaults.defaultBracket),
    defaultPlayers: intOrNull(raw.defaultPlayers, 2, 8) ?? defaults.defaultPlayers,
    tableIntro: str(raw.tableIntro, defaults.tableIntro),
    bracketCheckDone: raw.bracketCheckDone === true,
  }
}

function sanitizeTracker(raw: unknown): Tracker {
  if (!isObj(raw)) return emptyTracker()
  return {
    turn: intOrNull(raw.turn, 1, 99) ?? 1,
    power: intOrNull(raw.power, 0, 999) ?? 0,
    casts: intOrNull(raw.casts, 0, 20) ?? 0,
  }
}

function sanitizeDraft(raw: unknown, settings: Settings): Draft | null {
  if (!isObj(raw) || !isObj(raw.form)) return null
  return {
    startedAt: str(raw.startedAt, new Date().toISOString()),
    form: sanitizeInput(raw.form, settings),
    tracker: sanitizeTracker(raw.tracker),
  }
}

function sanitizeDecklist(raw: unknown): DeckEntry[] | null {
  if (!Array.isArray(raw)) return null
  const entries = raw
    .filter(isObj)
    .map((e) => {
      const set = str(e.set).trim().toLowerCase()
      const number = str(e.number).trim()
      return {
        name: str(e.name).trim(),
        qty: intOrNull(e.qty, 1, 99) ?? 0,
        ...(SET_RE.test(set) ? { set } : {}),
        ...(number && number.length <= 10 ? { number } : {}),
      }
    })
    .filter((e) => e.name && e.qty > 0)
  return entries.length > 0 ? entries : null
}

function sanitizeSwap(raw: unknown): Swap | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !DATE_RE.test(str(raw.date))) return null
  return {
    id: raw.id,
    date: str(raw.date),
    out: strList(raw.out),
    in: strList(raw.in),
    note: str(raw.note),
    createdAt: str(raw.createdAt, new Date().toISOString()),
  }
}

const LESSON_IDS = ['ghalta', 'combat', 'rules', 'mulligan', 'goldfish', 'cards'] as const

function sanitizeTraining(raw: unknown): TrainingResult | null {
  if (!isObj(raw) || !LESSON_IDS.includes(raw.lessonId as never)) return null
  const total = intOrNull(raw.total, 1, 100)
  const correct = intOrNull(raw.correct, 0, 100)
  if (total === null || correct === null || correct > total) return null
  return {
    lessonId: raw.lessonId as TrainingResult['lessonId'],
    date: DATE_RE.test(str(raw.date)) ? str(raw.date) : today(),
    correct,
    total,
    createdAt: str(raw.createdAt, new Date().toISOString()),
  }
}

const listOf = <T>(raw: unknown, fn: (x: unknown) => T | null): T[] =>
  Array.isArray(raw) ? raw.map(fn).filter((x): x is T => x !== null) : []

export function sanitizeData(raw: unknown): AppData {
  if (!isObj(raw)) return emptyData()
  const settings = sanitizeSettings(raw.settings)
  const defaults = emptyData()
  return {
    schemaVersion: 1,
    games: listOf(raw.games, (g) => sanitizeGame(g, settings)),
    settings,
    draft: sanitizeDraft(raw.draft, settings),
    commander: str(raw.commander).trim() || defaults.commander,
    commanderSet:
      typeof raw.commanderSet === 'string' && SET_RE.test(raw.commanderSet)
        ? raw.commanderSet
        : raw.commander === undefined
          ? defaults.commanderSet
          : null,
    decklist: sanitizeDecklist(raw.decklist) ?? defaults.decklist,
    swaps: listOf(raw.swaps, sanitizeSwap),
    training: listOf(raw.training, sanitizeTraining),
  }
}

/** Ist das noch die unveränderte Standard-Deckliste? */
export function isDefaultDeck(data: Pick<AppData, 'commander' | 'decklist'>): boolean {
  return data.commander === DEFAULT_COMMANDER && sameDecklist(data.decklist, DEFAULT_DECKLIST)
}

export function loadData(storage: Pick<Storage, 'getItem'>): AppData {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return emptyData()
  try {
    return sanitizeData(JSON.parse(raw))
  } catch {
    return emptyData()
  }
}

export function saveData(storage: Pick<Storage, 'setItem'>, data: AppData): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/** Swaps und Trainings zusammenführen: Duplikate (gleiche ID bzw. Zeitstempel) nur einmal. */
export function mergeBy<T>(current: T[], incoming: T[], keyOf: (x: T) => string): T[] {
  const seen = new Set(current.map(keyOf))
  return [...current, ...incoming.filter((x) => !seen.has(keyOf(x)))]
}

/** Spiele zusammenführen: gleiche ID → die zuletzt geänderte Version gewinnt. */
export function mergeGames(current: Game[], incoming: Game[]): Game[] {
  const byId = new Map(current.map((g) => [g.id, g]))
  for (const game of incoming) {
    const existing = byId.get(game.id)
    if (!existing || game.updatedAt > existing.updatedAt) byId.set(game.id, game)
  }
  return [...byId.values()]
}

/**
 * Backup einspielen: Spiele, Swaps und Trainings werden zusammengeführt.
 * Die Deckliste aus dem Backup wird übernommen, wenn hier noch die unveränderte
 * Standardliste liegt (typisch beim Umzug auf ein neues Handy).
 */
export function mergeImport(current: AppData, imported: AppData): { data: AppData; changedGames: number } {
  const games = mergeGames(current.games, imported.games)
  const before = new Map(current.games.map((g) => [g.id, g.updatedAt]))
  const changedGames = games.filter((g) => before.get(g.id) !== g.updatedAt).length
  const takeDeck = isDefaultDeck(current) && !isDefaultDeck(imported)
  return {
    changedGames,
    data: {
      ...current,
      games,
      swaps: mergeBy(current.swaps, imported.swaps, (s) => s.id),
      training: mergeBy(current.training, imported.training, (t) => `${t.lessonId}|${t.createdAt}`),
      commander: takeDeck ? imported.commander : current.commander,
      commanderSet: takeDeck ? imported.commanderSet : current.commanderSet,
      decklist: takeDeck ? imported.decklist : current.decklist,
    },
  }
}
