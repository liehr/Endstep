export type SkillId =
  | 'mulligan'
  | 'sequencing'
  | 'threat'
  | 'combat'
  | 'wipe'
  | 'removal'
  | 'politics'

/** Reid Duke's "Asking Why": reasons for a loss, in the order you check them. */
export type WhyCategory = 'mistake' | 'foresee' | 'deckbuilding' | 'wrongdeck' | 'luck'

export type Result = 'win' | 'loss'

/** How did it go with board wipes? */
export type WipeOutcome = 'none' | 'kept' | 'overextended'

export type Bracket = 1 | 2 | 3 | 4 | 5

/** Self-assessment of the focus skill: 1 = barely thought of it, 2 = partly, 3 = executed well. */
export type FocusRating = 1 | 2 | 3

export interface Game {
  id: string
  /** Game day as YYYY-MM-DD */
  playedAt: string
  deck: string
  bracket: Bracket
  players: number
  focus: SkillId
  focusRating: FocusRating | null
  result: Result
  /** Who won (name or commander). */
  winner: string
  /** Question 1: Why did the winner win? */
  whyWinner: string
  whyCategory: WhyCategory | null
  /** Question 2: Which one decision would I make differently? */
  decision: string
  decisionSkill: SkillId | null
  /** Question 3: Which cards were dead, which overperformed? */
  deadCards: string[]
  starCards: string[]
  /** Turn in which your commander was first cast. */
  commanderTurn: number | null
  /** How many (own) turns the game lasted. */
  turns: number | null
  mulligans: number | null
  wipe: WipeOutcome | null
  /** Bonus: What would someone else have done in my place? */
  feedback: string
  notes: string
  createdAt: string
  updatedAt: string
}

/** Everything entered in the form. */
export type GameInput = Omit<Game, 'id' | 'createdAt' | 'updatedAt'>

export interface Settings {
  defaultDeck: string
  defaultBracket: Bracket
  defaultPlayers: number
  /** The sentence you say at the table before the game. */
  tableIntro: string
  /** Bracket check (milestone on the path) already answered. */
  bracketCheckDone: boolean
  /** Lessons per day for the training streak. */
  dailyGoal: number
}

/** Counters during a game: current turn and Ghalta calculator. */
export interface Tracker {
  turn: number
  /** Total power of your own creatures (for Ghalta's cost). */
  power: number
  /** How often Ghalta has been cast from the command zone (commander tax). */
  casts: number
}

/** A game in progress: stored so nothing gets lost when the app is closed. */
export interface Draft {
  startedAt: string
  form: GameInput
  tracker: Tracker
}

export interface DeckEntry {
  name: string
  qty: number
  /** Set code of the printing (e.g. "fdc") so the right card images appear. */
  set?: string
  /** Collector number within the set. */
  number?: string
}

/** A swap round: cards out, cards in (upgrade roadmap from the learning plan). */
export interface Swap {
  id: string
  /** Deck name the swap belongs to. */
  deck: string
  /** The new deck version applies from this day (YYYY-MM-DD). */
  date: string
  out: string[]
  in: string[]
  note: string
  createdAt: string
}

export type LessonId = 'ghalta' | 'combat' | 'rules' | 'mulligan' | 'goldfish' | 'cards' | 'rulings' | 'scenario' | 'mistakes' | 'challenge'

export interface TrainingResult {
  lessonId: LessonId
  date: string
  correct: number
  total: number
  createdAt: string
}

/** Review state of one quiz question (Leitner box). */
export interface QuestionStat {
  /** 0 = just answered wrong … 4 = known well. */
  box: number
  /** Next review date (YYYY-MM-DD). */
  due: string
  seen: number
  wrong: number
  /** Last answered (YYYY-MM-DD). */
  last: string
  /** Last answered (ms timestamp), to rotate through topics and cards within a day. */
  at?: number
  /** Group of the question (e.g. the card it was about). */
  group?: string
}

/** Question key → review state. */
export type QuizMemory = Record<string, QuestionStat>

/** A deck you played before and can switch back to, as you left it. */
export interface SavedDeck {
  name: string
  commander: string
  commanderSet: string | null
  decklist: DeckEntry[]
  /** MTGJSON file of the precon; null for a pasted list. */
  precon: string | null
  bracket: Bracket
  bracketCheckDone: boolean
  tableIntro: string
}

export interface AppData {
  schemaVersion: 1
  games: Game[]
  settings: Settings
  draft: Draft | null
  /** Has a deck been picked (welcome screen)? Until then the app shows the deck picker. */
  deckChosen: boolean
  /** MTGJSON file of the precon the deck is based on (for "Reset to precon"); null for your own list. */
  precon: string | null
  /** Commander of the default deck (not counted). */
  commander: string
  /** Set code of the commander printing. */
  commanderSet: string | null
  /** The other 99 cards. */
  decklist: DeckEntry[]
  swaps: Swap[]
  /** Your other decks, each as you left it. The active deck lives in the fields above. */
  decks: SavedDeck[]
  training: TrainingResult[]
  /** Which quiz questions you've seen and when they're due again. */
  quiz: QuizMemory
}
