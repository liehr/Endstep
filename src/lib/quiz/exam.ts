import { EXAM_QUESTIONS } from '../content'
import { levelOf } from '../ranks'
import { mulberry32, shuffle } from '../sim/rng'
import type { LessonId } from '../types'
import { LESSON_BY_ID } from './quiz'
import type { Question, QuizContext } from './question'

// The rank exam: questions from all your lessons up to your rank, the hardest ones first
// (those of the rank itself), taken in turns from each lesson so every topic shows up.

export interface ExamItem {
  lessonId: LessonId
  question: Question
}

export function buildExam(lessonIds: LessonId[], ctx: Omit<QuizContext, 'rng'>, seed: number, rank: number, n = EXAM_QUESTIONS): ExamItem[] {
  const rng = mulberry32(seed)
  const pools = shuffle(lessonIds, rng).map((lessonId) => {
    // Strictly up to the rank: an exam doesn't borrow harder questions.
    const candidates = LESSON_BY_ID[lessonId].build({ ...ctx, rng }).filter((q) => levelOf(q.key) <= rank)
    // Stable sort: hardest level first, the lesson's shuffled order within a level.
    const sorted = [...candidates].sort((a, b) => Math.min(levelOf(b.key), rank) - Math.min(levelOf(a.key), rank))
    return { lessonId, queue: sorted }
  })
  const out: ExamItem[] = []
  const keys = new Set<string>()
  const groups = new Set<string>()
  while (out.length < n && pools.some((p) => p.queue.length)) {
    for (const pool of pools) {
      if (out.length >= n) break
      while (pool.queue.length) {
        const question = pool.queue.shift()!
        if (keys.has(question.key) || (question.group && groups.has(question.group))) continue
        keys.add(question.key)
        if (question.group) groups.add(question.group)
        out.push({ lessonId: pool.lessonId, question })
        break
      }
    }
  }
  return out
}
