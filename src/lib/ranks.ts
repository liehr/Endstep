import { QUESTION_LEVELS, RANK_GAMES, RANK_LESSON_SCORE, RANK_LESSON_SHARE, RANK_LESSONS, RANKS } from './content'
import type { Game, Promotion, SkillId, Swap, TrainingResult } from './types'

// Ranks from Bronze to Grandmaster (content in content.ts). Your rank is the highest one you
// were promoted to; everything else (progress, unlocked skills, question levels) is derived.

export const TOP_RANK = RANKS.length - 1

/** Index into RANKS: 0 = Bronze until the first exam is passed. */
export function currentRank(promotions: Promotion[]): number {
  return promotions.reduce((max, p) => Math.max(max, p.rank), 0)
}

/** When the current rank started (ISO timestamp); '' for Bronze, so your whole history counts there. */
export function rankStart(promotions: Promotion[]): string {
  const rank = currentRank(promotions)
  if (rank === 0) return ''
  return promotions.filter((p) => p.rank === rank).reduce((min, p) => (p.createdAt < min ? p.createdAt : min), '￿')
}

/** Focus skills unlocked up to this rank, in the order they unlock (= the focus rotation). */
export function unlockedSkills(rank: number): SkillId[] {
  return RANKS.slice(0, rank + 1).flatMap((r) => r.skills)
}

/** All focus skills in the order they unlock (the learning path on Home). */
export const SKILL_PATH: SkillId[] = unlockedSkills(RANKS.length - 1)

/** The rank in which a focus skill unlocks. */
export function skillRank(id: SkillId): number {
  const index = RANKS.findIndex((r) => r.skills.includes(id))
  return index < 0 ? 0 : index
}

/** Rank of a question, from its key ("card-cost:Llanowar Elves" → topic "card-cost" → Bronze). */
export function levelOf(key: string): number {
  const topic = key.split(':')[0]
  if (topic in QUESTION_LEVELS) return QUESTION_LEVELS[topic]
  for (const [pattern, level] of Object.entries(QUESTION_LEVELS)) {
    if (pattern.endsWith('*') && topic.startsWith(pattern.slice(0, -1))) return level
  }
  return 0
}

/** Is the topic listed in QUESTION_LEVELS (directly or via a "*" pattern)? */
export function hasLevel(key: string): boolean {
  const topic = key.split(':')[0]
  return topic in QUESTION_LEVELS || Object.keys(QUESTION_LEVELS).some((p) => p.endsWith('*') && topic.startsWith(p.slice(0, -1)))
}

/**
 * Questions up to your rank. If that leaves fewer than `min` (e.g. a lesson with few easy kinds),
 * the easiest of the harder ones fill up, so a lesson never runs dry. Keeps the original order.
 */
export function filterByLevel<T extends { key: string }>(questions: T[], maxLevel: number, min: number): T[] {
  const open = questions.filter((q) => levelOf(q.key) <= maxLevel)
  if (open.length >= min) return open
  const extra = questions
    .filter((q) => levelOf(q.key) > maxLevel)
    .sort((a, b) => levelOf(a.key) - levelOf(b.key))
    .slice(0, min - open.length)
  const keep = new Set([...open, ...extra])
  return questions.filter((q) => keep.has(q))
}

export interface RankProgress {
  rank: number
  /** Games recorded since the rank started. */
  games: number
  gamesTarget: number
  /** Lessons with a good score since the rank started. */
  lessons: number
  lessonsTarget: number
  /** Both goals met: the exam is unlocked. */
  examReady: boolean
  /** Grandmaster: no exam left. */
  top: boolean
}

/** A lesson that counts toward the exam: 4 of 5, 7 of 8, 8 of 10 (see Settings → lesson length). */
export const goodLesson = (t: TrainingResult) => t.correct >= RANK_LESSON_SCORE && t.correct >= RANK_LESSON_SHARE * t.total

export function rankProgress(promotions: Promotion[], games: Game[], training: TrainingResult[]): RankProgress {
  const rank = currentRank(promotions)
  const since = rankStart(promotions)
  const gamesIn = games.filter((g) => g.createdAt >= since).length
  // Ghalta Rush scores count answers in a minute, not out of a lesson: it doesn't count here.
  const lessonsIn = training.filter((t) => t.createdAt >= since && t.lessonId !== 'challenge' && goodLesson(t)).length
  const top = rank >= TOP_RANK
  return {
    rank,
    games: gamesIn,
    gamesTarget: RANK_GAMES,
    lessons: lessonsIn,
    lessonsTarget: RANK_LESSONS,
    examReady: !top && gamesIn >= RANK_GAMES && lessonsIn >= RANK_LESSONS,
    top,
  }
}

/** After passing the exam of `rank`: the promotion to the next rank. */
export function promote(promotions: Promotion[], now: Date = new Date()): Promotion[] {
  const rank = currentRank(promotions)
  if (rank >= TOP_RANK) return promotions
  const createdAt = now.toISOString()
  return [...promotions, { rank: rank + 1, date: createdAt.slice(0, 10), createdAt }]
}

/**
 * Reward for a promotion: one extra card in the next swap round of the deck you play. It doesn't
 * stack: one bonus card per swap round, as long as a promotion happened since that deck's last swap.
 */
export function swapBonus(promotions: Promotion[], deckSwaps: Swap[]): number {
  const last = deckSwaps.reduce((max, s) => (s.createdAt > max ? s.createdAt : max), '')
  return promotions.some((p) => p.createdAt > last) ? 1 : 0
}
