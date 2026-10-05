import { ArrowClockwiseIcon, ArrowRightIcon, CheckCircleIcon, HeartIcon, XCircleIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { AnswerLabel, CardFrame, type Slot } from '../components/CardFrame'
import { CardGrid } from '../components/CardImage'
import { Confetti } from '../components/Confetti'
import { Button, IconButton, ProgressBar } from '../components/ui'
import { haptic } from '../lib/haptics'
import type { FieldId } from '../lib/quiz/cardQuiz'
import { buildExam } from '../lib/quiz/exam'
import { buildLesson, LESSON_BY_ID, type Question } from '../lib/quiz/quiz'
import { currentRank } from '../lib/ranks'
import { EXAM_HEARTS } from '../lib/content'
import { RankEmblem, rankStyle } from '../components/RankEmblem'
import { ExamFailed, Promotion } from './Ranks'
import { navigate } from '../lib/route'
import { randomSeed } from '../lib/sim/rng'
import { actions, useData } from '../lib/store'
import type { LessonId } from '../lib/types'
import { useDeckCards } from '../lib/useDeckCards'
import { LESSON_ICON, lessonStyle, openLessons } from './Training'

/** Which blank does a tile belong to? */
function fieldOfTile(tile: string): FieldId {
  if (/^(\{[^}]+\})+$/.test(tile)) return 'cost'
  if (/^[\d*X+-]+\/[\d*X+-]+$/.test(tile)) return 'pt'
  return 'type'
}

interface Item {
  question: Question
  /** Lesson the question comes from (differs per question in the rank exam). */
  lessonId: LessonId
  /** Repeat of a wrongly answered question (doesn't count toward the score). */
  retry: boolean
}

/**
 * A lesson: question by question, like Duolingo. Wrong answers come back at the end.
 * With `exam`, it's the rank exam instead: questions from all lessons, no second tries,
 * and the exam ends when the hearts run out.
 */
export function Lesson({ id = 'rules', exam = false }: { id?: LessonId; exam?: boolean }) {
  const deck = useDeckCards({ autoLoad: false })
  const { quiz, promotions } = useData()
  // The rank you take the lesson or exam in (stays put when the exam promotes you).
  const [rank] = useState(() => currentRank(promotions))
  const build = (seed: number): Item[] => {
    const ctx = { decklist: deck.decklist, commander: deck.commander, lookup: deck.lookup, rulings: deck.rulings }
    if (exam) return buildExam(openLessons(deck), ctx, seed, rank).map((e) => ({ ...e, retry: false }))
    return buildLesson(id, ctx, seed, quiz, undefined, rank).map((question) => ({ question, lessonId: id, retry: false }))
  }
  const [queue, setQueue] = useState<Item[]>(() => build(randomSeed()))
  const [index, setIndex] = useState(0)
  /** Selection for single-choice questions. */
  const [selected, setSelected] = useState<string | null>(null)
  /** For "Build the card": per blank, the index of the placed tile. */
  const [slots, setSlots] = useState<(number | null)[]>([])
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [hearts, setHearts] = useState(EXAM_HEARTS)

  const firstTryTotal = queue.filter((i) => !i.retry).length
  const item = queue[index]
  const lesson = LESSON_BY_ID[item?.lessonId ?? id]

  const reset = () => {
    setSelected(null)
    setSlots([])
    setChecked(false)
  }

  const restart = () => {
    setQueue(build(randomSeed()))
    setIndex(0)
    reset()
    setScore(0)
    setDone(false)
    setHearts(EXAM_HEARTS)
  }

  if (exam && done) return hearts > 0 ? <Promotion rank={rank + 1} /> : <ExamFailed rank={rank} correct={score} onAgain={restart} />
  if (done) return <LessonDone id={id} score={score} total={firstTryTotal} onAgain={restart} />
  if (!item) return null

  const q = item.question
  const isBuild = q.kind === 'build'
  const blanks = q.blanks ?? []
  const bank = q.bank ?? []
  const filled = blanks.map((_, i) => slots[i] ?? null)
  const ready = isBuild ? filled.every((s) => s !== null) : selected !== null
  const correct = isBuild ? blanks.every((b, i) => filled[i] !== null && bank[filled[i]!] === b.answer) : selected === q.correct

  const check = () => {
    setChecked(true)
    if (!item.retry && lesson.remember) actions.recordQuizAnswer(q.key, correct, q.group)
    if (correct) {
      haptic(12)
      if (!item.retry) setScore((s) => s + 1)
    } else {
      haptic([30, 60, 30])
      if (exam) setHearts((h) => h - 1)
      else if (!item.retry) setQueue((qq) => [...qq, { ...item, retry: true }])
    }
  }

  const next = () => {
    if (exam && (hearts <= 0 || index + 1 >= queue.length)) {
      if (hearts > 0) actions.promote()
      setDone(true)
      return
    }
    if (index + 1 >= queue.length) {
      actions.addTrainingResult(id, score, firstTryTotal)
      setDone(true)
      return
    }
    setIndex(index + 1)
    reset()
    window.scrollTo(0, 0)
  }

  /** Place a tile into the blank of its kind (mana → cost, 5/4 → power …); a filled blank is swapped. */
  const placeTile = (tile: number) => {
    if (checked) return
    const field = fieldOfTile(bank[tile])
    const target = blanks.findIndex((b) => b.field === field)
    const slot = target >= 0 ? target : filled.findIndex((s) => s === null)
    if (slot < 0) return
    haptic()
    const nextSlots = [...filled]
    nextSlots[slot] = tile
    setSlots(nextSlots)
  }
  const clearSlot = (i: number) => {
    if (checked) return
    const nextSlots = [...filled]
    nextSlots[i] = null
    setSlots(nextSlots)
  }

  /** Blanks on the drawn card. */
  const frameSlots: Partial<Record<FieldId, Slot>> = {}
  if (q.face && q.hidden) {
    if (isBuild) {
      blanks.forEach((b, i) => {
        const value = filled[i] !== null ? bank[filled[i]!] : null
        const right = value === b.answer
        frameSlots[b.field] = {
          value: checked && !right ? b.answer : value,
          state: checked ? (right ? 'right' : 'corrected') : value ? 'filled' : 'empty',
          onClick: !checked && value ? () => clearSlot(i) : undefined,
        }
      })
    } else {
      const answer = q.options.find((o) => o.id === q.correct)?.label ?? null
      for (const field of q.hidden) frameSlots[field] = checked ? { value: answer, state: correct ? 'right' : 'corrected' } : { value: null, state: 'empty' }
    }
  }

  const twoUp = q.options.length === 2
  const usedTiles = new Set(filled.filter((s): s is number => s !== null))

  return (
    <div className="screen flow lesson" style={exam ? rankStyle(rank) : lessonStyle(id)}>
      <header className="flow-header">
        <IconButton icon={XIcon} label={exam ? 'End exam' : 'End lesson'} onClick={() => navigate(exam ? '/raenge' : '/training')} />
        <ProgressBar value={index / queue.length} label={`Question ${index + 1} of ${queue.length}`} />
        {exam && (
          <span className="hearts" aria-label={`${hearts} of ${EXAM_HEARTS} hearts left`}>
            {Array.from({ length: EXAM_HEARTS }, (_, i) => (
              <HeartIcon key={i} weight="fill" className={i < hearts ? '' : 'lost'} />
            ))}
          </span>
        )}
      </header>

      <div className="question-wrap" key={`${index}-${q.id}`}>
        <div className="question">
          {item.retry && <span className="retry-tag">Again</span>}
          <span className="eyebrow">
            {exam && <RankEmblem rank={rank} size={18} />} {exam ? `Exam · ${lesson.title}` : lesson.title}
          </span>
          <h1>{q.prompt}</h1>
          {q.context && <p className="muted">{q.context}</p>}
          <div className="question-body">
            {q.face && <CardFrame face={q.face} slots={frameSlots} />}
            {q.cards && q.cards.length > 0 && <CardGrid cards={q.cards} label={q.cardsLabel} />}

            {isBuild ? (
              <div className="tile-bank" aria-label="Tiles">
                {bank.map((tile, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`tile-chip ${usedTiles.has(i) ? 'used' : ''}`}
                    disabled={checked || usedTiles.has(i)}
                    onClick={() => placeTile(i)}
                  >
                    <AnswerLabel value={tile} />
                  </button>
                ))}
              </div>
            ) : (
              <div className={`quiz-options ${twoUp ? 'two' : ''}`} role="radiogroup">
                {q.options.map((o) => {
                  const state = !checked
                    ? selected === o.id
                      ? 'selected'
                      : ''
                    : o.id === q.correct
                      ? 'right'
                      : selected === o.id
                        ? 'wrong'
                        : 'dim'
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={selected === o.id}
                      className={`option quiz-option ${state}`}
                      disabled={checked}
                      onClick={() => {
                        haptic()
                        setSelected(o.id)
                      }}
                    >
                      <AnswerLabel value={o.label} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {checked ? (
        <footer className={`feedback ${correct ? 'right' : 'wrong'}`} role="status">
          <div className="feedback-head">
            {correct ? <CheckCircleIcon weight="fill" aria-hidden="true" /> : <XCircleIcon weight="fill" aria-hidden="true" />}
            <strong>{correct ? 'Correct!' : 'Not quite.'}</strong>
          </div>
          {!correct && !isBuild && (
            <p>
              Correct answer: <strong><AnswerLabel value={q.options.find((o) => o.id === q.correct)?.label ?? ''} /></strong>
            </p>
          )}
          <p>{q.explanation}</p>
          {q.details && (
            <details className="feedback-details">
              <summary>{q.details.title}</summary>
              <ol>
                {q.details.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ol>
            </details>
          )}
          <Button block variant={correct ? 'primary' : 'danger'} onClick={next}>
            Continue
          </Button>
        </footer>
      ) : (
        <footer className="flow-footer">
          <Button block disabled={!ready} onClick={check}>
            Check
          </Button>
        </footer>
      )}
    </div>
  )
}

function LessonDone({ id, score, total, onAgain }: { id: LessonId; score: number; total: number; onAgain: () => void }) {
  const IconCmp = LESSON_ICON[id]
  useEffect(() => haptic([12, 60, 12]), [])
  const perfect = score === total
  return (
    <div className="screen flow done" style={lessonStyle(id)}>
      {score > 0 && <Confetti />}
      <div className="intro">
        <span className="lesson-icon big" aria-hidden="true">
          <IconCmp weight="fill" />
        </span>
        <h1>{perfect ? 'Perfect!' : 'Lesson complete!'}</h1>
        <p className="lead">
          {perfect
            ? 'Everything right on the first try.'
            : score >= total - 1
              ? 'Almost everything right. Great job!'
              : "Every wrong answer here is one you won't get wrong at the table."}
        </p>
      </div>
      <div className="reward-tiles">
        <div className="reward rounds">
          <span className="reward-title">Correct</span>
          <span className="reward-value">
            {score} / {total}
          </span>
        </div>
        <div className="reward streak">
          <span className="reward-title">Rate</span>
          <span className="reward-value">{Math.round((score / Math.max(1, total)) * 100)}%</span>
        </div>
      </div>
      <footer className="flow-footer stack">
        <Button block icon={ArrowRightIcon} onClick={() => navigate('/training', { replace: true })}>
          Continue
        </Button>
        <Button block variant="secondary" icon={ArrowClockwiseIcon} onClick={onAgain}>
          Again
        </Button>
      </footer>
    </div>
  )
}
