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
  kind?: 'choice' | 'build' | 'order' | 'select'
  prompt: string
  /** Self-drawn card with hidden fields (card quiz). */
  face?: CardFace
  hidden?: FieldId[]
  /** For “build”: blanks in order and the tiles to choose from. */
  blanks?: Blank[]
  bank?: string[]
  /** For “order”: the items in the right order; they're shown shuffled in `bank`. */
  order?: string[]
  /** For “order”: further orders that also count as right (e.g. any order that works out). */
  accept?: string[][]
  /** For “select”: which of `cards` to tap. */
  select?: SelectRule
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

/**
 * Tap-on-board questions: "exact" = exactly these cards (by index in `cards`);
 * "fewest" = cards whose values add up to at least target, with as few cards as possible.
 */
export type SelectRule = { mode: 'exact'; correct: number[] } | { mode: 'fewest'; values: number[]; target: number }

/** Fewest values that add up to at least target (largest first is optimal); Infinity if impossible. */
export function fewestFor(values: number[], target: number): number {
  const sorted = [...values].sort((a, b) => b - a)
  let sum = 0
  for (const [i, v] of sorted.entries()) {
    if (sum >= target) return i
    sum += v
  }
  return sum >= target ? sorted.length : Infinity
}

export function selectIsCorrect(rule: SelectRule, picked: number[]): boolean {
  const set = new Set(picked)
  if (rule.mode === 'exact') return set.size === rule.correct.length && rule.correct.every((i) => set.has(i))
  const sum = [...set].reduce((s, i) => s + (rule.values[i] ?? 0), 0)
  return sum >= rule.target && set.size === fewestFor(rule.values, rule.target)
}

/** One right answer, to show after a wrong one. */
export function selectSolution(rule: SelectRule): number[] {
  if (rule.mode === 'exact') return [...rule.correct].sort((a, b) => a - b)
  const byValue = rule.values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
  return byValue.slice(0, fewestFor(rule.values, rule.target)).map((x) => x.i).sort((a, b) => a - b)
}

/** Order questions: the tapped sequence (indexes into the shuffled bank) matches a right order. */
export function orderIsCorrect(order: string[], bank: string[], sequence: number[], accept: string[][] = []): boolean {
  return [order, ...accept].some((o) => sequence.length === o.length && sequence.every((b, i) => bank[b] === o[i]))
}
