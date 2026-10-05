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
export function recordAnswer(memory: QuizMemory, key: string, correct: boolean, today: string): QuizMemory {
  const prev = memory[key]
  const box = correct ? Math.min(MAX_BOX, (prev ? prev.box : 0) + 1) : 0
  const stat: QuestionStat = {
    box,
    due: addDays(today, correct ? INTERVALS[box] : 0),
    seen: (prev?.seen ?? 0) + 1,
    wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
    last: today,
  }
  return { ...memory, [key]: stat }
}

/** 0 = due for review, 1 = new, 2 = seen and not due yet. */
function rank(stat: QuestionStat | undefined, today: string): number {
  if (!stat) return 1
  return stat.due <= today ? 0 : 2
}

/**
 * Pick n questions from the candidates: due reviews first (lowest box first), then new
 * questions, then the ones due soonest. At most maxPerTopic per topic while other topics
 * still have questions, and one question per group (e.g. per card) if possible.
 * Keeps the candidates' order in the result.
 */
export function selectQuestions<T extends { key: string; group?: string }>(
  candidates: T[],
  memory: QuizMemory,
  today: string,
  n: number,
  maxPerTopic = 2,
): T[] {
  const seenKeys = new Set<string>()
  const unique = candidates
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => !seenKeys.has(q.key) && (seenKeys.add(q.key), true))
  const ranked = [...unique].sort((a, b) => {
    const sa = memory[a.q.key]
    const sb = memory[b.q.key]
    const ra = rank(sa, today)
    const rb = rank(sb, today)
    if (ra !== rb) return ra - rb
    if (ra === 0 && sa!.box !== sb!.box) return sa!.box - sb!.box
    if (ra !== 1 && sa!.due !== sb!.due) return sa!.due < sb!.due ? -1 : 1
    return a.index - b.index
  })

  const picked = new Set<number>()
  const perTopic = new Map<string, number>()
  const groups = new Set<string>()
  // First pass: spread across topics, one question per group. Second: groups only. Third: fill up.
  for (const pass of [0, 1, 2]) {
    for (const { q, index } of ranked) {
      if (picked.size >= n) break
      if (picked.has(index)) continue
      const topic = topicOf(q.key)
      if (pass === 0 && (perTopic.get(topic) ?? 0) >= maxPerTopic) continue
      if (pass < 2 && q.group !== undefined && groups.has(q.group)) continue
      picked.add(index)
      perTopic.set(topic, (perTopic.get(topic) ?? 0) + 1)
      if (q.group !== undefined) groups.add(q.group)
    }
  }
  return unique.filter(({ index }) => picked.has(index)).map(({ q }) => q)
}
