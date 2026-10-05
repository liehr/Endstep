import type { CardInfo } from '../cards'
import type { Ruling } from '../scryfall'
import { shuffle, type Rng } from '../sim/rng'
import type { DeckEntry } from '../types'
import type { CardFace, FieldId } from './cardQuiz'

// Shared question types and helpers for all lessons.

export interface QuizOption {
  id: string
  label: string
}

export interface QuizCard {
  name: string
  /** Small caption under the image, e.g. “5/4”. */
  caption?: string
}

export interface Blank {
  field: FieldId
  answer: string
}

export interface Question {
  id: string
  /**
   * Stable key for the question memory, e.g. "card-cost:Llanowar Elves". The part before
   * the first ":" is the topic; a lesson spreads its questions across topics.
   */
  key: string
  /** Questions of the same group (e.g. about the same card) don't appear together. */
  group?: string
  /** “choice”: pick one answer; “build”: fill the blanks from the tile bank. */
  kind?: 'choice' | 'build'
  prompt: string
  /** Self-drawn card with hidden fields (card quiz). */
  face?: CardFace
  hidden?: FieldId[]
  /** For “build”: blanks in order and the tiles to choose from. */
  blanks?: Blank[]
  bank?: string[]
  cardsLabel?: string
  cards?: QuizCard[]
  /** Short text above the cards, e.g. the game situation. */
  context?: string
  options: QuizOption[]
  correct: string
  explanation: string
  /** Optional extra after the answer (e.g. turn log). */
  details?: { title: string; lines: string[] }
}

export interface QuizContext {
  rng: Rng
  decklist: DeckEntry[]
  commander: string
  lookup: (name: string) => CardInfo | undefined
  /** Rulings per card (loaded in the background); missing for older callers and tests. */
  rulings?: (name: string) => Ruling[] | undefined
}

export const QUESTIONS_PER_LESSON = 5

export const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)]
export const int = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1))

/** Shuffle answer options; remember the correct answer by ID. */
export function choice(rng: Rng, correctLabel: string, wrongLabels: string[]): { options: QuizOption[]; correct: string } {
  const unique = [...new Set(wrongLabels.filter((l) => l !== correctLabel))].slice(0, 3)
  const options = shuffle(
    [{ id: 'a', label: correctLabel }, ...unique.map((label, i) => ({ id: `w${i}`, label }))],
    rng,
  )
  return { options, correct: 'a' }
}

/** Options in a fixed order (e.g. turn 3, 4, 5 …). */
export function ordered(labels: string[], correctIndex: number): { options: QuizOption[]; correct: string } {
  return { options: labels.map((label, i) => ({ id: `o${i}`, label })), correct: `o${correctIndex}` }
}

