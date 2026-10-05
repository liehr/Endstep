import { DEFAULT_DECK, DEFAULT_TABLE_INTRO, SKILLS, WHY_CATEGORIES, WIPE_OPTIONS } from './content'
import { today } from './dates'
import type {
  AppData,
  Bracket,
  Draft,
  FocusRating,
  Game,
  GameInput,
  Result,
  Settings,
  SkillId,
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
  }
}

export function emptyData(): AppData {
  return { schemaVersion: 1, games: [], settings: defaultSettings(), draft: null }
}

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
  }
}

function sanitizeDraft(raw: unknown, settings: Settings): Draft | null {
  if (!isObj(raw) || !isObj(raw.form)) return null
  return {
    startedAt: str(raw.startedAt, new Date().toISOString()),
    form: sanitizeInput(raw.form, settings),
  }
}

export function sanitizeData(raw: unknown): AppData {
  if (!isObj(raw)) return emptyData()
  const settings = sanitizeSettings(raw.settings)
  const games = Array.isArray(raw.games)
    ? raw.games.map((g) => sanitizeGame(g, settings)).filter((g): g is Game => g !== null)
    : []
  return { schemaVersion: 1, games, settings, draft: sanitizeDraft(raw.draft, settings) }
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

/** Spiele zusammenführen: gleiche ID → die zuletzt geänderte Version gewinnt. */
export function mergeGames(current: Game[], incoming: Game[]): Game[] {
  const byId = new Map(current.map((g) => [g.id, g]))
  for (const game of incoming) {
    const existing = byId.get(game.id)
    if (!existing || game.updatedAt > existing.updatedAt) byId.set(game.id, game)
  }
  return [...byId.values()]
}
