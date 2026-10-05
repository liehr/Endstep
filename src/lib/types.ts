export type SkillId =
  | 'mulligan'
  | 'sequencing'
  | 'threat'
  | 'combat'
  | 'wipe'
  | 'removal'
  | 'politics'

/** Reid Dukes „Asking Why“: Gründe für eine Niederlage, in der Reihenfolge, in der man sie prüft. */
export type WhyCategory = 'mistake' | 'foresee' | 'deckbuilding' | 'wrongdeck' | 'luck'

export type Result = 'win' | 'loss'

/** Wie lief es mit Board Wipes? */
export type WipeOutcome = 'none' | 'kept' | 'overextended'

export type Bracket = 1 | 2 | 3 | 4 | 5

/** Selbsteinschätzung zum Fokus-Skill: 1 = kaum dran gedacht, 2 = teilweise, 3 = gut umgesetzt. */
export type FocusRating = 1 | 2 | 3

export interface Game {
  id: string
  /** Spieltag als YYYY-MM-DD */
  playedAt: string
  deck: string
  bracket: Bracket
  players: number
  focus: SkillId
  focusRating: FocusRating | null
  result: Result
  /** Wer hat gewonnen (Name oder Commander). */
  winner: string
  /** Frage 1: Warum hat der Gewinner gewonnen? */
  whyWinner: string
  whyCategory: WhyCategory | null
  /** Frage 2: Welche eine Entscheidung würde ich anders treffen? */
  decision: string
  decisionSkill: SkillId | null
  /** Frage 3: Welche Karten waren tot, welche haben überperformt? */
  deadCards: string[]
  starCards: string[]
  ghaltaTurn: number | null
  /** Wie viele Züge (eigene) die Partie lief. */
  turns: number | null
  mulligans: number | null
  wipe: WipeOutcome | null
  /** Bonus: Was hätte jemand anderes an meiner Stelle gemacht? */
  feedback: string
  notes: string
  createdAt: string
  updatedAt: string
}

/** Alles, was man im Formular eingibt. */
export type GameInput = Omit<Game, 'id' | 'createdAt' | 'updatedAt'>

export interface Settings {
  defaultDeck: string
  defaultBracket: Bracket
  defaultPlayers: number
  /** Der Satz, den man vor dem Spiel am Tisch sagt. */
  tableIntro: string
}

/** Zähler während einer Runde: aktueller Zug und Ghalta-Rechner. */
export interface Tracker {
  turn: number
  /** Gesamtstärke der eigenen Kreaturen (für Ghaltas Kosten). */
  power: number
  /** Wie oft Ghalta schon aus der Command Zone gecastet wurde (Commander-Steuer). */
  casts: number
}

/** Eine laufende Runde: wird gespeichert, damit nichts verloren geht, wenn die App geschlossen wird. */
export interface Draft {
  startedAt: string
  form: GameInput
  tracker: Tracker
}

export interface DeckEntry {
  name: string
  qty: number
  /** Set-Code der Druckversion (z. B. „fdc“), damit die richtigen Kartenbilder erscheinen. */
  set?: string
  /** Sammlernummer innerhalb des Sets. */
  number?: string
}

/** Eine Swap-Runde: Karten raus, Karten rein (Upgrade-Fahrplan aus dem Lernplan). */
export interface Swap {
  id: string
  /** Ab diesem Tag gilt die neue Deckversion (YYYY-MM-DD). */
  date: string
  out: string[]
  in: string[]
  note: string
  createdAt: string
}

export type LessonId = 'ghalta' | 'combat' | 'rules' | 'mulligan' | 'goldfish' | 'cards'

export interface TrainingResult {
  lessonId: LessonId
  date: string
  correct: number
  total: number
  createdAt: string
}

export interface AppData {
  schemaVersion: 1
  games: Game[]
  settings: Settings
  draft: Draft | null
  /** Commander des Standard-Decks (wird nicht mitgezählt). */
  commander: string
  /** Set-Code der Commander-Druckversion. */
  commanderSet: string | null
  /** Die 99 anderen Karten. */
  decklist: DeckEntry[]
  swaps: Swap[]
  training: TrainingResult[]
}
