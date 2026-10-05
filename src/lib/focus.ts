import { SKILLS } from './content'
import type { Game, SkillId } from './types'

/** Neueste Spiele zuerst (nach Spieltag, bei Gleichstand nach Erfassungszeit). */
export function sortGames(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => b.playedAt.localeCompare(a.playedAt) || b.createdAt.localeCompare(a.createdAt),
  )
}

/** Nächster Fokus-Skill in der Rotation, ausgehend vom zuletzt gespielten Spiel. */
export function nextFocus(games: Game[]): SkillId {
  const last = sortGames(games)[0]
  if (!last) return SKILLS[0].id
  const index = SKILLS.findIndex((s) => s.id === last.focus)
  return SKILLS[(index + 1) % SKILLS.length].id
}
