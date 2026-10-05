import { ArrowClockwiseIcon, ArrowRightIcon, CheckCircleIcon, XCircleIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { AnswerLabel, CardFrame, type Slot } from '../components/CardFrame'
import { CardGrid, PickCardGrid, type PickState } from '../components/CardImage'
import { Confetti } from '../components/Confetti'
import { Button, EmptyState, IconButton, ProgressBar } from '../components/ui'
import { haptic } from '../lib/haptics'
import type { FieldId } from '../lib/quiz/cardQuiz'
import { buildLesson, LESSON_BY_ID, orderIsCorrect, selectIsCorrect, selectSolution, type Question } from '../lib/quiz/quiz'
import { navigate } from '../lib/route'
import { randomSeed } from '../lib/sim/rng'
import { actions, useData } from '../lib/store'
import type { LessonId } from '../lib/types'
import { useDeckCards } from '../lib/useDeckCards'
import { LESSON_ICON, lessonStyle } from './Training'

/** Which blank does a tile belong to? */
function fieldOfTile(tile: string): FieldId {
  if (/^(\{[^}]+\})+$/.test(tile)) return 'cost'
  if (/^[\d*X+-]+\/[\d*X+-]+$/.test(tile)) return 'pt'
  return 'type'
}

interface Item {
  question: Question
  /** Repeat of a wrongly answered question (doesn't count toward the score). */
  retry: boolean
}

/** A lesson: question by question, like Duolingo. Wrong answers come back at the end. */
export function Lesson({ id }: { id: LessonId }) {
  const deck = useDeckCards({ autoLoad: false })
  const { quiz, games } = useData()
  const build = (seed: number) =>
    buildLesson(id, { decklist: deck.decklist, commander: deck.commander, lookup: deck.lookup, rulings: deck.rulings, games }, seed, quiz).map((question) => ({
      question,
      retry: false,
    }))
  const [queue, setQueue] = useState<Item[]>(() => build(randomSeed()))
  const [index, setIndex] = useState(0)
  /** Selection for single-choice questions. */
  const [selected, setSelected] = useState<string | null>(null)
  /** For "Build the card": per blank, the index of the placed tile. */
  const [slots, setSlots] = useState<(number | null)[]>([])
  /** For order questions: tapped bank indexes, first to last. */
  const [sequence, setSequence] = useState<number[]>([])
  /** For tap-on-board questions: indexes of the tapped cards. */
  const [picks, setPicks] = useState<number[]>([])
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const lesson = LESSON_BY_ID[id]
  const firstTryTotal = queue.filter((i) => !i.retry).length
  const item = queue[index]

  const reset = () => {
    setSelected(null)
    setSlots([])
    setSequence([])
    setPicks([])
    setChecked(false)
  }

  const restart = () => {
    setQueue(build(randomSeed()))
    setIndex(0)
    reset()
    setScore(0)
    setDone(false)
  }

  if (done) return <LessonDone id={id} score={score} total={firstTryTotal} onAgain={restart} />
  if (queue.length === 0)
    return (
      <div className="screen flow">
        <EmptyState title="Nothing to review" text="No recent mistakes left. Nice work!">
          <Button onClick={() => navigate('/training', { replace: true })}>Back to Training</Button>
        </EmptyState>
      </div>
    )
  if (!item) return null

  const q = item.question
  const isBuild = q.kind === 'build'
  const blanks = q.blanks ?? []
  const bank = q.bank ?? []
  const order = q.order ?? []
  const filled = blanks.map((_, i) => slots[i] ?? null)
  const ready =
    q.kind === 'order' ? sequence.length === order.length : q.kind === 'select' ? picks.length > 0 : isBuild ? filled.every((s) => s !== null) : selected !== null
  const correct =
    q.kind === 'order'
      ? orderIsCorrect(order, bank, sequence, q.accept)
      : q.kind === 'select'
        ? selectIsCorrect(q.select!, picks)
        : isBuild
          ? blanks.every((b, i) => filled[i] !== null && bank[filled[i]!] === b.answer)
          : selected === q.correct

  const check = () => {
    setChecked(true)
    if (!item.retry && lesson.remember) {
      actions.recordQuizAnswer(q.key, correct, q.group)
      if (q.reviewOf) actions.recordQuizAnswer(q.reviewOf, correct)
    }
    if (correct) {
      haptic(12)
      if (!item.retry) setScore((s) => s + 1)
    } else {
      haptic([30, 60, 30])
      if (!item.retry) setQueue((qq) => [...qq, { question: q, retry: true }])
    }
  }

  const next = () => {
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

  const togglePick = (i: number) => {
    if (checked) return
    haptic()
    setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))
  }
  const solution = q.kind === 'select' && checked ? new Set(correct ? picks : selectSolution(q.select!)) : null
  const pickStates: PickState[] = (q.cards ?? []).map((_, i) => {
    const picked = picks.includes(i)
    if (!solution) return picked ? 'selected' : ''
    if (picked) return solution.has(i) ? 'right' : 'wrong'
    return solution.has(i) ? 'missed' : ''
  })

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
    <div className="screen flow lesson" style={lessonStyle(id)}>
      <header className="flow-header">
        <IconButton icon={XIcon} label="End lesson" onClick={() => navigate('/training')} />
        <ProgressBar value={index / queue.length} label={`Question ${index + 1} of ${queue.length}`} />
      </header>

      <div className="question-wrap" key={`${index}-${q.id}`}>
        <div className="question">
          {item.retry && <span className="retry-tag">Again</span>}
          <span className="eyebrow">{lesson.title}</span>
          {q.note && <p className="question-note small">{q.note}</p>}
          <h1>{q.prompt}</h1>
          {q.context && <p className="muted">{q.context}</p>}
          <div className="question-body">
            {q.face && <CardFrame face={q.face} slots={frameSlots} />}
            {q.kind === 'select' && q.cards ? (
              <PickCardGrid cards={q.cards} states={pickStates} disabled={checked} onToggle={togglePick} />
            ) : (
              q.cards && q.cards.length > 0 && <CardGrid cards={q.cards} label={q.cardsLabel} />
            )}

            {q.kind === 'select' ? null : q.kind === 'order' ? (
              <>
                <ol className="order-slots" aria-label="Your order">
                  {order.map((_, i) => {
                    const b = sequence[i]
                    const value = b !== undefined ? bank[b] : null
                    const state = value === null ? '' : !checked ? 'filled' : correct || value === order[i] ? 'right' : 'wrong'
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          className={`order-slot ${state}`}
                          disabled={checked || value === null}
                          aria-label={value ? `${i + 1}. ${value}, tap to remove` : `${i + 1}. empty`}
                          onClick={() => setSequence(sequence.filter((_, j) => j !== i))}
                        >
                          <span className="order-num">{i + 1}</span>
                          <span>{value ?? ''}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
                <div className="tile-bank" aria-label="Tap in order">
                  {bank.map((tile, i) => {
                    const used = sequence.includes(i)
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`tile-chip ${used ? 'used' : ''}`}
                        disabled={checked || used}
                        onClick={() => {
                          haptic()
                          setSequence([...sequence, i])
                        }}
                      >
                        {tile}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : isBuild ? (
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
          {!correct && q.kind === 'order' && <p>{q.accept?.length ? 'An order that works:' : 'Correct order:'}</p>}
          {!correct && q.kind === 'order' && (
            <ol className="order-steps">
              {order.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
          {!correct && (q.kind ?? 'choice') === 'choice' && (
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
