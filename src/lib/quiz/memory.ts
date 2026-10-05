import type { QuestionStat, QuizMemory } from '../types'

// Question memory with a simple Leitner schedule: every question has a stable key.
// A wrong answer puts it back in box 0 (due again right away), each right answer moves
// it up one box and pushes the next review further out.

/** Days until the next review, per box. */
export const INTERVALS = [0, 1, 3, 7, 16] as const
const MAX_BOX = INTERVALS.length - 1

/** "card-cost:Llanowar Elves" → "card-cost". Questions of one topic are spread out. */
export const topicOf = (key: string) => key.split(':')[0]

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** Store the answer to a question (first try only; retries within a lesson don't count). */
export function recordAnswer(
  memory: QuizMemory,
  key: string,
  correct: boolean,
  today: string,
  { at, group }: { at?: number; group?: string } = {},
): QuizMemory {
  const prev = memory[key]
  const box = correct ? Math.min(MAX_BOX, (prev ? prev.box : 0) + 1) : 0
  const stat: QuestionStat = {
    box,
    due: addDays(today, correct ? INTERVALS[box] : 0),
    seen: (prev?.seen ?? 0) + 1,
    wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
    last: today,
    ...(at !== undefined ? { at } : {}),
    ...(group !== undefined ? { group } : {}),
  }
  return { ...memory, [key]: stat }
}

/** 0 = due for review, 1 = new, 2 = seen and not due yet. */
function rank(stat: QuestionStat | undefined, today: string): number {
  if (!stat) return 1
  return stat.due <= today ? 0 : 2
}

export interface SelectOptions {
  /** At most this many questions of one topic while other topics still have questions. */
  maxPerTopic?: number
  /** At most this many due reviews, so every lesson also brings new questions. */
  maxReviews?: number
}

/**
 * Pick n questions from the candidates: due reviews first (lowest box first, at most
 * maxReviews), then new questions, then the ones due soonest. New questions rotate: cards
 * (groups) and topics you haven't seen for the longest time come first, so a lesson walks
 * through the whole deck before a card comes back. One question per group if possible.
 * Keeps the candidates' order in the result.
 */
export function selectQuestions<T extends { key: string; group?: string }>(
  candidates: T[],
  memory: QuizMemory,
  today: string,
  n: number,
  { maxPerTopic = 2, maxReviews = 2 }: SelectOptions = {},
): T[] {
  const seenKeys = new Set<string>()
  const unique = candidates
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => !seenKeys.has(q.key) && (seenKeys.add(q.key), true))

  // When was each topic and group last asked?
  const topicAt = new Map<string, number>()
  const groupAt = new Map<string, number>()
  for (const [key, stat] of Object.entries(memory)) {
    const at = stat.at ?? 0
    const topic = topicOf(key)
    topicAt.set(topic, Math.max(topicAt.get(topic) ?? -1, at))
    if (stat.group !== undefined) groupAt.set(stat.group, Math.max(groupAt.get(stat.group) ?? -1, at))
  }
  const lastAsked = (q: T) => (q.group !== undefined ? groupAt.get(q.group) : topicAt.get(topicOf(q.key))) ?? -Infinity

  const ranked = unique
    .map((c) => ({ ...c, stat: memory[c.q.key], rank: rank(memory[c.q.key], today), last: lastAsked(c.q) }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      if (a.rank === 0 && a.stat!.box !== b.stat!.box) return a.stat!.box - b.stat!.box
      if (a.rank !== 1 && a.stat!.due !== b.stat!.due) return a.stat!.due < b.stat!.due ? -1 : 1
      if (a.rank === 1 && a.last !== b.last) return a.last - b.last
      return a.index - b.index
    })

  const picked = new Set<number>()
  const perTopic = new Map<string, number>()
  const groups = new Set<string>()
  let reviews = 0
  // First pass: spread across topics, one question per group, few reviews. Second: groups
  // and reviews only. Third: fill up.
  for (const pass of [0, 1, 2]) {
    for (const { q, index, rank: r } of ranked) {
      if (picked.size >= n) break
      if (picked.has(index)) continue
      const topic = topicOf(q.key)
      if (pass === 0 && (perTopic.get(topic) ?? 0) >= maxPerTopic) continue
      if (pass < 2 && q.group !== undefined && groups.has(q.group)) continue
      if (pass < 2 && r === 0 && reviews >= maxReviews) continue
      picked.add(index)
      perTopic.set(topic, (perTopic.get(topic) ?? 0) + 1)
      if (q.group !== undefined) groups.add(q.group)
      if (r === 0) reviews++
    }
  }
  return unique.filter(({ index }) => picked.has(index)).map(({ q }) => q)
}
