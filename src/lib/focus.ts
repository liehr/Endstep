import { SKILLS } from './content'
import type { Game, SkillId } from './types'

/** Newest games first (by game day, ties broken by time recorded). */
export function sortGames(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => b.playedAt.localeCompare(a.playedAt) || b.createdAt.localeCompare(a.createdAt),
  )
}

/** Next focus skill in the rotation, based on the most recently played game. */
export function nextFocus(games: Game[]): SkillId {
  const last = sortGames(games)[0]
  if (!last) return SKILLS[0].id
  const index = SKILLS.findIndex((s) => s.id === last.focus)
  return SKILLS[(index + 1) % SKILLS.length].id
}
