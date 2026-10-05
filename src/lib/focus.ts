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
 * rank has unlocked take part, in the order given (all skills in SKILLS order by default). Games
 * whose focus came from the wheel don't move the rotation on.
 */
export function nextFocus(games: Game[], unlocked: SkillId[] = SKILLS.map((s) => s.id)): SkillId {
  if (unlocked.length === 0) return SKILLS[0].id
  const last = sortGames(games.filter((g) => !g.spun))[0]
  const index = last ? unlocked.indexOf(last.focus) : -1
  return unlocked[(index + 1) % unlocked.length]
}

/** Focus for the next game: a wheel spin wins over the rotation. */
export function upcomingFocus(games: Game[], unlocked: SkillId[], spin: SkillId | null): SkillId {
  return spin ?? nextFocus(games, unlocked)
}

// --- Lucky wheel -------------------------------------------------------------
// The wheel isn't tied to your rank: every focus skill is on it.

export const WHEEL_SKILLS: SkillId[] = SKILLS.map((s) => s.id)

/** Spin the wheel: any focus skill with the same chance. */
export function spinWheel(random: () => number, skills: SkillId[] = WHEEL_SKILLS): SkillId {
  return skills[Math.min(skills.length - 1, Math.floor(random() * skills.length))]
}

/**
 * Wheel angle (degrees, clockwise) at which the slice `index` of `count` sits under the pointer at
 * the top, after at least `turns` full turns from `from`. `nudge` (-1…1) shifts the stop inside
 * the slice so it doesn't always land dead centre.
 */
export function wheelAngle(from: number, index: number, count: number, turns = 5, nudge = 0): number {
  const slice = 360 / count
  const target = -index * slice + nudge * slice * 0.35
  const base = from + turns * 360
  return base + ((((target - base) % 360) + 360) % 360)
}

/** Which slice is under the pointer at the top for a wheel turned by `angle` degrees. */
export function sliceAt(angle: number, count: number): number {
  const slice = 360 / count
  const a = ((-angle % 360) + 360) % 360
  return Math.round(a / slice) % count
}
