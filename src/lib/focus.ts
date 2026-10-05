import { SKILLS } from './content'
import type { Game, SkillId } from './types'

/** Newest games first (by game day, ties broken by time recorded). */
export function sortGames(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => b.playedAt.localeCompare(a.playedAt) || b.createdAt.localeCompare(a.createdAt),
  )
}

/**
 * Next focus skill in the rotation, based on the most recently played game. Only the skills your
 * rank has unlocked take part, in the order given (all skills in SKILLS order by default).
 */
export function nextFocus(games: Game[], unlocked: SkillId[] = SKILLS.map((s) => s.id)): SkillId {
  if (unlocked.length === 0) return SKILLS[0].id
  const last = sortGames(games)[0]
  const index = last ? unlocked.indexOf(last.focus) : -1
  return unlocked[(index + 1) % unlocked.length]
}
