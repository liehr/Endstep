import {
  BRACKET_CHECK_GAMES,
  BRACKET_CHECK_OPTIONS,
  DEFAULT_DECK,
  DEFAULT_TABLE_INTRO,
  EXAM_HEART_OPTIONS,
  EXAM_HEARTS,
  LESSON_LENGTHS,
  MISTAKE_DAY_OPTIONS,
  PATTERN_OPTIONS,
  PATTERN_THRESHOLD,
  RANKS,
  SKILLS,
  tableIntroFor,
  UPGRADE_EVERY_GAMES,
  UPGRADE_EVERY_OPTIONS,
  WHY_CATEGORIES,
  WIPE_OPTIONS,
} from './content'
import { MISTAKE_DAYS } from './quiz/memory'
import { QUESTIONS_PER_LESSON } from './quiz/question'
import { DAILY_GOALS } from './trainingStreak'
import { today } from './dates'
import { cardKey } from './cards'
import { DEFAULT_COMMANDER, DEFAULT_DECKLIST, DEFAULT_PRECON, DEFAULT_SET, sameDecklist } from './decklist'
import type {
  AppData,
  Bracket,
  DeckEntry,
  Draft,
  FocusRating,
  Game,
  GameInput,
  Promotion,
  QuizMemory,
  Result,
  SavedDeck,
  Settings,
  SkillId,
  Swap,
  Theme,
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
    dailyGoal: 1,
    theme: 'system',
    haptics: true,
    celebrations: true,
    diceButton: true,
    showDailyGoal: true,
    lessonLength: QUESTIONS_PER_LESSON,
    warmUps: true,
    mistakeDays: MISTAKE_DAYS,
    examHearts: EXAM_HEARTS,
    upgradeEvery: UPGRADE_EVERY_GAMES,
    bracketCheckGames: BRACKET_CHECK_GAMES,
    patternThreshold: PATTERN_THRESHOLD,
  }
}

/** Settings from the settings page, back to their defaults (deck, table and progress stay). */
export function resetPreferences(settings: Settings): Settings {
  const { defaultDeck, defaultBracket, defaultPlayers, tableIntro, bracketCheckDone } = settings
  return { ...defaultSettings(), defaultDeck, defaultBracket, defaultPlayers, tableIntro, bracketCheckDone }
}

export function emptyData(): AppData {
  return {
    schemaVersion: 1,
    games: [],
    settings: defaultSettings(),
    draft: null,
    // Until a deck is picked on the welcome screen, the Ghalta precon stands in.
    deckChosen: false,
    precon: DEFAULT_PRECON,
    commander: DEFAULT_COMMANDER,
    commanderSet: DEFAULT_SET,
    decklist: DEFAULT_DECKLIST.map((e) => ({ ...e })),
    swaps: [],
    decks: [],
    training: [],
    quiz: {},
    promotions: [],
    deleted: {},
    stamps: { settings: '', deck: '' },
    spin: null,
  }
}

export const emptyTracker = (): Tracker => ({ turn: 1, power: 0, casts: 0 })

export function emptyInput(settings: Settings, focus: SkillId, spun = false): GameInput {
  return {
    playedAt: today(),
    deck: settings.defaultDeck,
    bracket: settings.defaultBracket,
    players: settings.defaultPlayers,
    focus,
    spun,
    focusRating: null,
    result: 'loss',
    winner: '',
    whyWinner: '',
    whyCategory: null,
    decision: '',
    decisionSkill: null,
    deadCards: [],
    starCards: [],
    commanderTurn: null,
    turns: null,
    mulligans: null,
    wipe: null,
    feedback: '',
    notes: '',
  }
}

// --- Validation ------------------------------------------------------------
// Data comes from localStorage or imported backups and may come from older
// versions or be corrupted. So everything is checked field by field and
// reset to safe defaults.

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

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
const THEMES: Theme[] = ['system', 'light', 'dark']
const RATINGS: FocusRating[] = [1, 2, 3]
const RESULTS: Result[] = ['win', 'loss']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SET_RE = /^[a-z0-9]{2,6}$/
const PRECON_RE = /^[A-Za-z0-9_]{1,80}$/

export function sanitizeInput(raw: Obj, settings: Settings): GameInput {
  return {
    playedAt: DATE_RE.test(str(raw.playedAt)) ? str(raw.playedAt) : today(),
    deck: str(raw.deck).trim() || settings.defaultDeck,
    bracket: oneOf(raw.bracket, BRACKETS, settings.defaultBracket),
    players: intOrNull(raw.players, 2, 8) ?? settings.defaultPlayers,
    focus: oneOf<SkillId>(raw.focus, SKILL_IDS, SKILL_IDS[0]),
    spun: raw.spun === true,
    focusRating: oneOf<FocusRating | null>(raw.focusRating, RATINGS, null),
    result: oneOf(raw.result, RESULTS, 'loss'),
    winner: str(raw.winner),
    whyWinner: str(raw.whyWinner),
    whyCategory: oneOf<WhyCategory | null>(raw.whyCategory, WHY_IDS, null),
    decision: str(raw.decision),
    decisionSkill: oneOf<SkillId | null>(raw.decisionSkill, SKILL_IDS, null),
    deadCards: strList(raw.deadCards),
    starCards: strList(raw.starCards),
    // Called ghaltaTurn before the app supported other decks.
    commanderTurn: intOrNull(raw.commanderTurn ?? raw.ghaltaTurn, 1, 99),
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
    dailyGoal: oneOf(raw.dailyGoal, DAILY_GOALS, defaults.dailyGoal),
    theme: oneOf(raw.theme, THEMES, defaults.theme),
    haptics: bool(raw.haptics, defaults.haptics),
    celebrations: bool(raw.celebrations, defaults.celebrations),
    diceButton: bool(raw.diceButton, defaults.diceButton),
    showDailyGoal: bool(raw.showDailyGoal, defaults.showDailyGoal),
    lessonLength: oneOf(raw.lessonLength, LESSON_LENGTHS, defaults.lessonLength),
    warmUps: bool(raw.warmUps, defaults.warmUps),
    mistakeDays: oneOf(raw.mistakeDays, MISTAKE_DAY_OPTIONS, defaults.mistakeDays),
    examHearts: oneOf(raw.examHearts, EXAM_HEART_OPTIONS, defaults.examHearts),
    upgradeEvery: oneOf(raw.upgradeEvery, UPGRADE_EVERY_OPTIONS, defaults.upgradeEvery),
    bracketCheckGames: oneOf(raw.bracketCheckGames, BRACKET_CHECK_OPTIONS, defaults.bracketCheckGames),
    patternThreshold: oneOf(raw.patternThreshold, PATTERN_OPTIONS, defaults.patternThreshold),
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

function sanitizeSwap(raw: unknown, settings: Settings): Swap | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !DATE_RE.test(str(raw.date))) return null
  return {
    id: raw.id,
    // Older swaps have no deck: back then there was only one.
    deck: str(raw.deck).trim() || settings.defaultDeck,
    date: str(raw.date),
    out: strList(raw.out),
    in: strList(raw.in),
    note: str(raw.note),
    createdAt: str(raw.createdAt, new Date().toISOString()),
  }
}

function sanitizeSavedDeck(raw: unknown, settings: Settings): SavedDeck | null {
  if (!isObj(raw)) return null
  const name = str(raw.name).trim()
  const commander = str(raw.commander).trim()
  const decklist = sanitizeDecklist(raw.decklist)
  if (!name || !commander || !decklist) return null
  return {
    name,
    commander,
    commanderSet: typeof raw.commanderSet === 'string' && SET_RE.test(raw.commanderSet) ? raw.commanderSet : null,
    decklist,
    precon: typeof raw.precon === 'string' && PRECON_RE.test(raw.precon) ? raw.precon : null,
    bracket: oneOf(raw.bracket, BRACKETS, settings.defaultBracket),
    bracketCheckDone: raw.bracketCheckDone === true,
    tableIntro: str(raw.tableIntro, tableIntroFor(name, commander, false, settings.defaultBracket)),
    ...(typeof raw.savedAt === 'string' && raw.savedAt ? { savedAt: raw.savedAt } : {}),
  }
}

/** Saved decks: each name once, never the active deck. */
export const otherDecks = (decks: SavedDeck[], active: string) =>
  decks.filter((d, i) => cardKey(d.name) !== cardKey(active) && decks.findIndex((x) => cardKey(x.name) === cardKey(d.name)) === i)

const LESSON_IDS = ['ghalta', 'combat', 'rules', 'mulligan', 'goldfish', 'cards', 'rulings', 'scenario', 'mistakes', 'challenge'] as const

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

function sanitizePromotion(raw: unknown): Promotion | null {
  if (!isObj(raw)) return null
  const rank = intOrNull(raw.rank, 1, RANKS.length - 1)
  const createdAt = str(raw.createdAt)
  if (rank === null || !createdAt) return null
  return { rank, date: DATE_RE.test(str(raw.date)) ? str(raw.date) : createdAt.slice(0, 10), createdAt }
}

function sanitizeQuiz(raw: unknown): QuizMemory {
  if (!isObj(raw)) return {}
  const out: QuizMemory = {}
  for (const [key, stat] of Object.entries(raw)) {
    if (!isObj(stat) || key.length > 300) continue
    const box = intOrNull(stat.box, 0, 4)
    if (box === null || !DATE_RE.test(str(stat.due)) || !DATE_RE.test(str(stat.last))) continue
    out[key] = {
      box,
      due: str(stat.due),
      last: str(stat.last),
      seen: intOrNull(stat.seen, 0, 100000) ?? 0,
      wrong: intOrNull(stat.wrong, 0, 100000) ?? 0,
      ...(typeof stat.at === 'number' && Number.isFinite(stat.at) && stat.at >= 0 ? { at: stat.at } : {}),
      ...(typeof stat.group === 'string' && stat.group.length <= 200 ? { group: stat.group } : {}),
    }
  }
  return out
}

/** Merge question memory: per question, the more recently answered state wins. */
export function mergeQuiz(current: QuizMemory, incoming: QuizMemory): QuizMemory {
  const out = { ...current }
  for (const [key, stat] of Object.entries(incoming)) {
    const mine = out[key]
    if (!mine || stat.last > mine.last || (stat.last === mine.last && (stat.at ?? 0) > (mine.at ?? 0))) out[key] = stat
  }
  return out
}

function sanitizeDeleted(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isObj(raw)) return out
  for (const [key, at] of Object.entries(raw)) {
    if (/^(game|swap|deck):/.test(key) && typeof at === 'string' && at) out[key] = at
  }
  return out
}

function sanitizeStamps(raw: unknown): AppData['stamps'] {
  const stamps = isObj(raw) ? raw : {}
  return { settings: str(stamps.settings), deck: str(stamps.deck) }
}

const listOf = <T>(raw: unknown, fn: (x: unknown) => T | null): T[] =>
  Array.isArray(raw) ? raw.map(fn).filter((x): x is T => x !== null) : []

export function sanitizeData(raw: unknown): AppData {
  if (!isObj(raw)) return emptyData()
  const settings = sanitizeSettings(raw.settings)
  const defaults = emptyData()
  const commander = str(raw.commander).trim() || defaults.commander
  return {
    schemaVersion: 1,
    games: listOf(raw.games, (g) => sanitizeGame(g, settings)),
    settings,
    draft: sanitizeDraft(raw.draft, settings),
    // Data from before the welcome screen: the deck was chosen back then (always a Ghalta deck).
    deckChosen:
      typeof raw.deckChosen === 'boolean'
        ? raw.deckChosen
        : raw.commander !== undefined || (Array.isArray(raw.games) && raw.games.length > 0),
    precon:
      typeof raw.precon === 'string' && PRECON_RE.test(raw.precon)
        ? raw.precon
        : raw.precon === undefined && cardKey(commander) === cardKey(DEFAULT_COMMANDER)
          ? DEFAULT_PRECON
          : null,
    commander,
    commanderSet:
      typeof raw.commanderSet === 'string' && SET_RE.test(raw.commanderSet)
        ? raw.commanderSet
        : raw.commander === undefined
          ? defaults.commanderSet
          : null,
    decklist: sanitizeDecklist(raw.decklist) ?? defaults.decklist,
    swaps: listOf(raw.swaps, (s) => sanitizeSwap(s, settings)),
    decks: otherDecks(listOf(raw.decks, (d) => sanitizeSavedDeck(d, settings)), settings.defaultDeck),
    training: listOf(raw.training, sanitizeTraining),
    quiz: sanitizeQuiz(raw.quiz),
    promotions: listOf(raw.promotions, sanitizePromotion),
    deleted: sanitizeDeleted(raw.deleted),
    stamps: sanitizeStamps(raw.stamps),
    spin: oneOf<SkillId | null>(raw.spin, SKILL_IDS, null),
  }
}

/** Is this still the unchanged default decklist? */
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

/** Merge swaps and training results: duplicates (same ID or timestamp) only once. */
export function mergeBy<T>(current: T[], incoming: T[], keyOf: (x: T) => string): T[] {
  const seen = new Set(current.map(keyOf))
  return [...current, ...incoming.filter((x) => !seen.has(keyOf(x)))]
}

/** Merge games: same ID → the most recently changed version wins. */
export function mergeGames(current: Game[], incoming: Game[]): Game[] {
  const byId = new Map(current.map((g) => [g.id, g]))
  for (const game of incoming) {
    const existing = byId.get(game.id)
    if (!existing || game.updatedAt > existing.updatedAt) byId.set(game.id, game)
  }
  return [...byId.values()]
}

/**
 * Restore a backup: games, swaps, training results and question memory are merged.
 * The deck from the backup is taken over if no deck has been picked yet or the unchanged
 * default list is still here (typical when moving to a new phone). Without a picked deck,
 * the settings (deck name, table) come from the backup too.
 */
export function mergeImport(current: AppData, imported: AppData): { data: AppData; changedGames: number } {
  const games = mergeGames(current.games, imported.games)
  const before = new Map(current.games.map((g) => [g.id, g.updatedAt]))
  const changedGames = games.filter((g) => before.get(g.id) !== g.updatedAt).length
  const fresh = !current.deckChosen && imported.deckChosen
  const takeDeck = fresh || (isDefaultDeck(current) && !isDefaultDeck(imported))
  const settings = fresh ? imported.settings : current.settings
  // The backup's active deck joins your other decks unless it's the one you play now.
  const backupActive = imported.deckChosen && !fresh ? [activeDeck(imported)] : []
  return {
    changedGames,
    data: {
      ...current,
      settings,
      decks: otherDecks([...current.decks, ...imported.decks, ...backupActive], settings.defaultDeck),
      deckChosen: current.deckChosen || imported.deckChosen,
      precon: takeDeck ? imported.precon : current.precon,
      games,
      swaps: mergeBy(current.swaps, imported.swaps, (s) => s.id),
      training: mergeBy(current.training, imported.training, (t) => `${t.lessonId}|${t.createdAt}`),
      quiz: mergeQuiz(current.quiz, imported.quiz),
      promotions: mergeBy(current.promotions, imported.promotions, (p) => String(p.rank)),
      commander: takeDeck ? imported.commander : current.commander,
      commanderSet: takeDeck ? imported.commanderSet : current.commanderSet,
      decklist: takeDeck ? imported.decklist : current.decklist,
    },
  }
}

/** A deck picked on the welcome screen or when changing decks. */
export interface ChosenDeck {
  name: string
  commander: string
  commanderSet: string | null
  decklist: DeckEntry[]
  /** MTGJSON file of the precon; null for a pasted list. */
  precon: string | null
}

/** The active deck as it would be saved when you switch away from it. */
export function activeDeck(data: AppData): SavedDeck {
  const { settings } = data
  return {
    name: settings.defaultDeck,
    commander: data.commander,
    commanderSet: data.commanderSet,
    decklist: data.decklist,
    precon: data.precon,
    bracket: settings.defaultBracket,
    bracketCheckDone: settings.bracketCheckDone,
    tableIntro: settings.tableIntro,
  }
}

const isSaved = (deck: ChosenDeck | SavedDeck): deck is SavedDeck => 'bracket' in deck

/**
 * Switch to another deck. The deck you leave is kept under "Your decks" with its list, bracket
 * and table talk. Games and swaps stay too: they carry the deck name, so stats and the upgrade
 * chest follow the active deck. For a new deck the table talk is rewritten unless you changed it.
 */
export function switchDeck(data: AppData, deck: ChosenDeck | SavedDeck): AppData {
  const { settings } = data
  const sameDeck = cardKey(deck.name) === cardKey(settings.defaultDeck)
  const leaving = { ...activeDeck(data), savedAt: new Date().toISOString() }
  const decks = otherDecks(data.deckChosen && !sameDeck ? [...data.decks, leaving] : data.decks, deck.name)
  if (isSaved(deck)) {
    return {
      ...data,
      deckChosen: true,
      precon: deck.precon,
      commander: deck.commander,
      commanderSet: deck.commanderSet,
      decklist: deck.decklist,
      decks,
      settings: { ...settings, defaultDeck: deck.name, defaultBracket: deck.bracket, bracketCheckDone: deck.bracketCheckDone, tableIntro: deck.tableIntro },
    }
  }
  const previousIntro = tableIntroFor(settings.defaultDeck, data.commander, data.precon !== null, settings.defaultBracket)
  const keepIntro = data.deckChosen && settings.tableIntro !== DEFAULT_TABLE_INTRO && settings.tableIntro !== previousIntro
  return {
    ...data,
    decks,
    deckChosen: true,
    precon: deck.precon,
    commander: deck.commander,
    commanderSet: deck.commanderSet,
    decklist: deck.decklist,
    settings: {
      ...settings,
      defaultDeck: deck.name,
      tableIntro: keepIntro ? settings.tableIntro : tableIntroFor(deck.name, deck.commander, deck.precon !== null, settings.defaultBracket),
      bracketCheckDone: sameDeck && settings.bracketCheckDone,
    },
  }
}

/** Forget a saved deck. Its games and swaps stay in the history. */
export const removeDeck = (data: AppData, name: string): AppData => ({ ...data, decks: data.decks.filter((d) => cardKey(d.name) !== cardKey(name)) })

/** Is this name taken by one of your other decks? */
export const deckNameTaken = (data: AppData, name: string) => data.decks.some((d) => cardKey(d.name) === cardKey(name))

/** Save settings; renaming the deck takes its swap history along. */
export function applySettings(data: AppData, settings: Settings): AppData {
  const from = cardKey(data.settings.defaultDeck)
  const renamed = from !== cardKey(settings.defaultDeck)
  return {
    ...data,
    settings,
    swaps: renamed ? data.swaps.map((s) => (cardKey(s.deck) === from ? { ...s, deck: settings.defaultDeck } : s)) : data.swaps,
  }
}

/** Swaps of the given deck, in the order they were made. */
export const swapsOf = (swaps: Swap[], deck: string) => swaps.filter((s) => cardKey(s.deck) === cardKey(deck))
