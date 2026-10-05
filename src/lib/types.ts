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

/** Eine laufende Runde: wird gespeichert, damit nichts verloren geht, wenn die App geschlossen wird. */
export interface Draft {
  startedAt: string
  form: GameInput
}

export interface AppData {
  schemaVersion: 1
  games: Game[]
  settings: Settings
  draft: Draft | null
}
