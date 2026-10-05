import { addDays } from './dates'
import type { TrainingResult } from './types'

// Daily training goal like Duolingo: a few lessons a day keep the streak going.
// Separate from the game streak, which counts weeks (see streak.ts).

/** Lessons per day you can pick as a goal. */
export const DAILY_GOALS = [1, 2, 3, 5] as const

export interface TrainingDay {
  /** Lessons finished today. */
  done: number
  goal: number
  /** Goal reached today. */
  met: boolean
  /** Days in a row with the goal reached; today counts once it's reached, until then the streak from yesterday holds. */
  current: number
  best: number
}

export function trainingDay(training: TrainingResult[], today: string, goal: number): TrainingDay {
  const perDay = new Map<string, number>()
  for (const t of training) perDay.set(t.date, (perDay.get(t.date) ?? 0) + 1)
  const met = (day: string) => (perDay.get(day) ?? 0) >= goal
  const done = perDay.get(today) ?? 0

  let current = 0
  for (let day = met(today) ? today : addDays(today, -1); met(day); day = addDays(day, -1)) current++

  let best = 0
  let run = 0
  let prev: string | null = null
  for (const day of [...perDay.keys()].filter(met).sort()) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    prev = day
  }
  return { done, goal, met: met(today), current, best }
}
