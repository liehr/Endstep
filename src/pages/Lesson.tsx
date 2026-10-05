import { ArrowClockwiseIcon, ArrowRightIcon, CheckCircleIcon, XCircleIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { AnswerLabel, CardFrame, type Slot } from '../components/CardFrame'
import { CardGrid } from '../components/CardImage'
import { Confetti } from '../components/Confetti'
import { Button, IconButton, ProgressBar } from '../components/ui'
import { haptic } from '../lib/haptics'
import type { FieldId } from '../lib/quiz/cardQuiz'
import { buildLesson, LESSON_BY_ID, type Question } from '../lib/quiz/quiz'
import { navigate } from '../lib/route'
import { randomSeed } from '../lib/sim/rng'
import { actions } from '../lib/store'
import type { LessonId } from '../lib/types'
import { useDeckCards } from '../lib/useDeckCards'
import { LESSON_ICON, lessonStyle } from './Training'

/** Zu welcher Lücke gehört eine Kachel? */
function fieldOfTile(tile: string): FieldId {
  if (/^(\{[^}]+\})+$/.test(tile)) return 'cost'
  if (/^[\d*X+-]+\/[\d*X+-]+$/.test(tile)) return 'pt'
  return 'type'
}

interface Item {
  question: Question
  /** Wiederholung einer falsch beantworteten Frage (zählt nicht für die Wertung). */
  retry: boolean
}

/** Eine Lektion: Frage für Frage, wie bei Duolingo. Falsche Antworten kommen am Ende noch einmal. */
export function Lesson({ id }: { id: LessonId }) {
  const deck = useDeckCards({ autoLoad: false })
  const build = (seed: number) =>
    buildLesson(id, { decklist: deck.decklist, commander: deck.commander, lookup: deck.lookup }, seed).map((question) => ({
      question,
      retry: false,
    }))
  const [queue, setQueue] = useState<Item[]>(() => build(randomSeed()))
  const [index, setIndex] = useState(0)
  /** Auswahl bei Einfachauswahl-Fragen. */
  const [selected, setSelected] = useState<string | null>(null)
  /** Bei „Baue die Karte“: je Lücke der Index der gelegten Kachel. */
  const [slots, setSlots] = useState<(number | null)[]>([])
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const lesson = LESSON_BY_ID[id]
  const firstTryTotal = queue.filter((i) => !i.retry).length
  const item = queue[index]

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
  }

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

  /** Kachel in die Lücke ihrer Art legen (Mana → Kosten, 5/4 → Stärke …); belegte Lücke wird getauscht. */
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

  /** Lücken auf der gezeichneten Karte. */
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
        <IconButton icon={XIcon} label="Lektion beenden" onClick={() => navigate('/training')} />
        <ProgressBar value={index / queue.length} label={`Frage ${index + 1} von ${queue.length}`} />
      </header>

      <div className="question-wrap" key={`${index}-${q.id}`}>
        <div className="question">
          {item.retry && <span className="retry-tag">Nochmal</span>}
          <span className="eyebrow">{lesson.title}</span>
          <h1>{q.prompt}</h1>
          {q.context && <p className="muted">{q.context}</p>}
          <div className="question-body">
            {q.face && <CardFrame face={q.face} slots={frameSlots} />}
            {q.cards && q.cards.length > 0 && <CardGrid cards={q.cards} label={q.cardsLabel} />}

            {isBuild ? (
              <div className="tile-bank" aria-label="Kacheln">
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
            <strong>{correct ? 'Richtig!' : 'Nicht ganz.'}</strong>
          </div>
          {!correct && !isBuild && (
            <p>
              Richtig wäre: <strong><AnswerLabel value={q.options.find((o) => o.id === q.correct)?.label ?? ''} /></strong>
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
            Weiter
          </Button>
        </footer>
      ) : (
        <footer className="flow-footer">
          <Button block disabled={!ready} onClick={check}>
            Prüfen
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
        <h1>{perfect ? 'Perfekt!' : 'Lektion geschafft!'}</h1>
        <p className="lead">
          {perfect
            ? 'Alles richtig beim ersten Versuch.'
            : score >= total - 1
              ? 'Fast alles richtig. Stark!'
              : 'Jede falsche Antwort ist eine, die du am Tisch nicht mehr falsch machst.'}
        </p>
      </div>
      <div className="reward-tiles">
        <div className="reward rounds">
          <span className="reward-title">Richtig</span>
          <span className="reward-value">
            {score} / {total}
          </span>
        </div>
        <div className="reward streak">
          <span className="reward-title">Quote</span>
          <span className="reward-value">{Math.round((score / Math.max(1, total)) * 100)} %</span>
        </div>
      </div>
      <footer className="flow-footer stack">
        <Button block icon={ArrowRightIcon} onClick={() => navigate('/training', { replace: true })}>
          Weiter
        </Button>
        <Button block variant="secondary" icon={ArrowClockwiseIcon} onClick={onAgain}>
          Nochmal
        </Button>
      </footer>
    </div>
  )
}
