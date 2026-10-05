import type { Game } from './types'

// Serie in Wochen statt Tagen: Commander spielt man meist einmal pro Woche
// (z. B. donnerstags). Eine Woche zählt, wenn mindestens eine Runde darin liegt.

const DAY_MS = 24 * 60 * 60 * 1000

function toUtc(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Montag der Woche (als UTC-Zeitstempel). */
function weekStart(isoDate: string): number {
  const t = toUtc(isoDate)
  const weekday = (new Date(t).getUTCDay() + 6) % 7 // Montag = 0
  return t - weekday * DAY_MS
}

const WEEK_MS = 7 * DAY_MS

export interface Streak {
  /** Aktuelle Serie in Wochen. Die laufende Woche darf noch leer sein. */
  current: number
  /** Längste Serie bisher. */
  best: number
  /** Wurde in dieser Woche schon gespielt? */
  playedThisWeek: boolean
}

export function weekStreak(games: Game[], today: string): Streak {
  const weeks = new Set(games.map((g) => weekStart(g.playedAt)))
  const thisWeek = weekStart(today)
  const playedThisWeek = weeks.has(thisWeek)

  let current = 0
  for (let w = playedThisWeek ? thisWeek : thisWeek - WEEK_MS; weeks.has(w); w -= WEEK_MS) current++

  let best = 0
  let run = 0
  let prev: number | null = null
  for (const w of [...weeks].sort((a, b) => a - b)) {
    run = prev !== null && w - prev === WEEK_MS ? run + 1 : 1
    best = Math.max(best, run)
    prev = w
  }

  return { current, best, playedThisWeek }
}
