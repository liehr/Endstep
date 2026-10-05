import { describe, expect, it } from 'vitest'
import { trainingDay } from './trainingStreak'
import type { TrainingResult } from './types'

const t = (date: string): TrainingResult => ({ lessonId: 'rules', date, correct: 4, total: 5, createdAt: `${date}T10:00:00Z` })

describe('trainingDay', () => {
  it('counts days in a row with the goal reached', () => {
    const training = [t('2026-10-01'), t('2026-10-02'), t('2026-10-03'), t('2026-10-04')]
    expect(trainingDay(training, '2026-10-04', 1)).toMatchObject({ done: 1, met: true, current: 4, best: 4 })
  })

  it('keeps yesterday’s streak while today is still open', () => {
    const training = [t('2026-10-03'), t('2026-10-04')]
    expect(trainingDay(training, '2026-10-05', 1)).toMatchObject({ done: 0, met: false, current: 2 })
  })

  it('a missed day breaks the streak, the best one stays', () => {
    const training = [t('2026-09-01'), t('2026-09-02'), t('2026-09-03'), t('2026-10-03')]
    expect(trainingDay(training, '2026-10-05', 1)).toMatchObject({ current: 0, best: 3 })
  })

  it('a bigger goal needs more lessons per day, across month ends', () => {
    const training = [t('2026-09-30'), t('2026-09-30'), t('2026-10-01'), t('2026-10-01'), t('2026-10-02')]
    expect(trainingDay(training, '2026-10-02', 2)).toMatchObject({ done: 1, met: false, current: 2, best: 2 })
    expect(trainingDay(training, '2026-10-02', 1)).toMatchObject({ met: true, current: 3 })
  })
})
