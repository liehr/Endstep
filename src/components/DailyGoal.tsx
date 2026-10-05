import { BarbellIcon, CheckIcon, LightningIcon } from '@phosphor-icons/react'
import { useState, type CSSProperties } from 'react'
import { today } from '../lib/dates'
import { nextFocus } from '../lib/focus'
import { LESSON_BY_ID, lessonOpen, reviewCount, warmUpLesson } from '../lib/quiz/quiz'
import { useDeckCards } from '../lib/useDeckCards'
import { navigate } from '../lib/route'
import { actions, useData } from '../lib/store'
import { DAILY_GOALS, trainingDay } from '../lib/trainingStreak'
import { BottomSheet, Button, Choice } from './ui'

const lessons = (n: number) => `${n} lesson${n === 1 ? '' : 's'}`

/** Today's training goal and the training streak, on the home page. */
export function DailyGoal() {
  const { training, settings, quiz, games } = useData()
  const deck = useDeckCards({ autoLoad: false })
  const [open, setOpen] = useState(false)
  const day = trainingDay(training, today(), settings.dailyGoal)
  const progress = Math.min(1, day.done / day.goal)
  // Mistakes first, otherwise a warm-up for the next game's focus skill.
  const review = reviewCount(quiz, games)
  const next = review.questions + review.games > 0 ? 'mistakes' : warmUpLesson(nextFocus(games), (id) => lessonOpen(LESSON_BY_ID[id], deck))
  const nextLabel = next === 'mistakes' ? 'Your Mistakes' : `${LESSON_BY_ID[next].title} (warm-up)`

  return (
    <>
      <section className={`card daily-goal ${day.met ? 'met' : ''}`} aria-label="Daily training">
        <button type="button" className="daily-goal-info" onClick={() => setOpen(true)} aria-label="Daily goal, tap to change">
          <span className="goal-ring" style={{ '--p': `${Math.round(progress * 100)}%` } as CSSProperties} aria-hidden="true">
            <span>{day.met ? <CheckIcon weight="bold" /> : <BarbellIcon weight="fill" />}</span>
          </span>
          <span className="daily-goal-text">
            <strong>{day.met ? 'Goal reached!' : 'Daily training'}</strong>
            <span className="muted small">
              {Math.min(day.done, day.goal)} of {lessons(day.goal)} today
            </span>
            {!day.met && <span className="small daily-goal-next">Next: {nextLabel}</span>}
          </span>
          <span className={`training-streak ${day.current > 0 ? 'on' : ''}`} title="Days in a row with your goal reached">
            <LightningIcon weight="fill" aria-hidden="true" />
            {day.current}
            <span className="sr-only"> day training streak</span>
          </span>
        </button>
        {!day.met && (
          <Button size="sm" onClick={() => navigate(`/training/${next}`)}>
            Train
          </Button>
        )}
      </section>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Daily training goal">
        <p className="muted">
          Short lessons between game nights. Reach your goal every day to keep the streak going: {day.current} day{day.current === 1 ? '' : 's'} now,
          best {day.best}.
        </p>
        <Choice
          options={DAILY_GOALS.map((g) => ({ id: g, label: lessons(g), hint: g === 1 ? 'A few minutes' : g >= 5 ? 'Serious' : undefined }))}
          value={settings.dailyGoal}
          onChange={(g) => g !== null && actions.updateSettings({ ...settings, dailyGoal: g })}
        />
        <Button block variant="secondary" onClick={() => setOpen(false)}>
          Done
        </Button>
      </BottomSheet>
    </>
  )
}
