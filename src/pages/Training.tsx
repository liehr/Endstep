import {
  ArrowClockwiseIcon,
  CardsIcon,
  CardsThreeIcon,
  CloudArrowDownIcon,
  CrosshairIcon,
  FlaskIcon,
  FootprintsIcon,
  GraduationCapIcon,
  HourglassIcon,
  LockIcon,
  PlayIcon,
  ScalesIcon,
  SwordIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button, EmptyState } from '../components/ui'
import { shortName } from '../lib/commander'
import { LESSONS } from '../lib/quiz/quiz'
import { navigate } from '../lib/route'
import { buildLibrary, seedFor, simCommander, simulateGame, summarize, type Distribution } from '../lib/sim/goldfish'
import { randomSeed } from '../lib/sim/rng'
import { swapsOf } from '../lib/data'
import { computeStats } from '../lib/stats'
import { useData } from '../lib/store'
import type { LessonId, SkillId } from '../lib/types'
import { skillStyle } from '../components/skills'
import { useDeckCards } from '../lib/useDeckCards'

export const LESSON_ICON: Record<LessonId, Icon> = {
  ghalta: CrosshairIcon,
  combat: SwordIcon,
  rules: GraduationCapIcon,
  mulligan: CardsIcon,
  goldfish: HourglassIcon,
  cards: CardsThreeIcon,
  rulings: ScalesIcon,
  scenario: FootprintsIcon,
}

/** Colors (with matching icon color) from the validated skill palette, so everything fits together. */
const LESSON_SKILL: Record<LessonId, SkillId> = {
  ghalta: 'combat',
  combat: 'threat',
  rules: 'sequencing',
  mulligan: 'mulligan',
  goldfish: 'politics',
  cards: 'removal',
  rulings: 'wipe',
  scenario: 'sequencing',
}

export const lessonStyle = (id: LessonId): CSSProperties => skillStyle(LESSON_SKILL[id])

/** At least this share of deck cards must be loaded for simulations to make sense. */
const MIN_COVERAGE = 0.9

export function Training() {
  const { training } = useData()
  const deck = useDeckCards()
  const ready = deck.coverage >= MIN_COVERAGE

  const totalCorrect = training.reduce((s, t) => s + t.correct, 0)
  const totalAnswered = training.reduce((s, t) => s + t.total, 0)

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Training</h1>
          <p className="muted">Short lessons for between game nights.</p>
        </div>
      </header>

      {training.length > 0 && (
        <div className="stat-grid">
          <div className="stat-tile">
            <span className="stat-label">Lessons</span>
            <strong className="stat-value">{training.length}</strong>
          </div>
          <div className="stat-tile">
            <span className="stat-label">Correct</span>
            <strong className="stat-value">{Math.round((totalCorrect / totalAnswered) * 100)}%</strong>
            <span className="stat-sub">
              {totalCorrect} of {totalAnswered}
            </span>
          </div>
        </div>
      )}

      {!ready && <CardDataNotice deck={deck} />}

      <ul className="lessons">
        {LESSONS.filter((l) => !l.forCommander || l.forCommander(deck.commander)).map((lesson) => {
          const IconCmp = LESSON_ICON[lesson.id]
          const results = training.filter((t) => t.lessonId === lesson.id)
          const best = results.reduce((m, t) => Math.max(m, t.correct), 0)
          const needsRulings = ready && lesson.ready !== undefined && !lesson.ready(deck)
          const locked = (lesson.needsCards && !ready) || needsRulings
          return (
            <li key={lesson.id}>
              <button
                type="button"
                className={`lesson-card ${locked ? 'locked' : ''}`}
                style={lessonStyle(lesson.id)}
                disabled={locked}
                onClick={() => navigate(`/training/${lesson.id}`)}
              >
                <span className="lesson-icon" aria-hidden="true">
                  {locked ? <LockIcon weight="fill" /> : <IconCmp weight="fill" />}
                </span>
                <span className="lesson-text">
                  <strong>{lesson.title}</strong>
                  <span className="muted small">{needsRulings && lesson.id !== 'rulings'
                      ? "Needs your commander's card data."
                      : needsRulings
                      ? deck.rulingsStatus === 'loading'
                        ? 'Loading rulings…'
                        : 'Rulings load in the background when you’re online.'
                      : locked
                        ? "Needs your deck's card data."
                        : lesson.description}</span>
                  {results.length > 0 && (
                    <span className="lesson-progress">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} className={i < best ? 'on' : ''} />
                      ))}
                      <span className="small muted">
                        {results.length}× played
                      </span>
                    </span>
                  )}
                </span>
                {!locked && <PlayIcon weight="fill" className="lesson-play" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>

      {ready && deck.lookup(deck.commander) ? <GoldfishLab /> : null}
    </div>
  )
}

function CardDataNotice({ deck }: { deck: ReturnType<typeof useDeckCards> }) {
  const loading = deck.status === 'loading'
  return (
    <section className="panel notice">
      <h2>Load card data</h2>
      <p className="muted">
        For the Mulligan Trainer and the simulation, Endstep loads your deck's cards from Scryfall once. After that,
        everything works offline too.
      </p>
      {deck.error && <p className="error-text">{deck.error}</p>}
      <Button icon={loading ? ArrowClockwiseIcon : CloudArrowDownIcon} disabled={loading} onClick={() => void deck.load(true)}>
        {loading ? 'Loading…' : 'Load cards'}
      </Button>
    </section>
  )
}

// --- Goldfish Lab -------------------------------------------------------------------

const LAB_GAMES = 1000
const CHUNK = 100

function GoldfishLab() {
  const { games, settings, swaps: allSwaps } = useData()
  const swaps = swapsOf(allSwaps, settings.defaultDeck)
  const deck = useDeckCards({ autoLoad: false })
  const [result, setResult] = useState<Distribution | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const cancelled = useRef(false)
  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  const realAvg = computeStats(games, settings.defaultDeck).avgCommanderTurn

  const commanderCard = deck.lookup(deck.commander)
  const name = shortName(deck.commander)

  const run = () => {
    if (!commanderCard) return
    const commander = simCommander(commanderCard)
    const library = buildLibrary(deck.decklist, deck.lookup)
    const seed = randomSeed()
    const turns: (number | null)[] = []
    const mulligans: number[] = []
    setProgress(0)
    const step = () => {
      if (cancelled.current) return
      for (let i = turns.length; i < Math.min(LAB_GAMES, turns.length + CHUNK); i++) {
        const g = simulateGame(library, seedFor(seed, i), commander)
        turns.push(g.commanderTurn)
        mulligans.push(g.mulligans)
      }
      if (turns.length < LAB_GAMES) {
        setProgress(turns.length / LAB_GAMES)
        setTimeout(step, 0)
      } else {
        setResult(summarize(turns, mulligans))
        setProgress(null)
      }
    }
    setTimeout(step, 0)
  }

  return (
    <section className="panel lab">
      <div className="lab-head">
        <span className="lesson-icon" style={{ '--c': 'var(--brand)', '--c-ink': 'var(--on-brand)' } as CSSProperties} aria-hidden="true">
          <FlaskIcon weight="fill" />
        </span>
        <div>
          <h2>Goldfish Lab</h2>
          <p className="muted small">
            {LAB_GAMES.toLocaleString('en-GB')} games with your current deck{swaps.length ? ` (after ${swaps.length} swap round${swaps.length > 1 ? 's' : ''})` : ''}: when does
            {` ${name}`} land?
          </p>
        </div>
      </div>

      {progress !== null ? (
        <div className="lab-progress" role="status">
          <div className="progress">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="muted small">Simulating… {Math.round(progress * 100)}%</span>
        </div>
      ) : (
        <Button variant={result ? 'secondary' : 'primary'} icon={result ? ArrowClockwiseIcon : PlayIcon} onClick={run}>
          {result ? 'Simulate again' : 'Start simulation'}
        </Button>
      )}

      {result && <LabResult result={result} realAvg={realAvg} name={name} />}
    </section>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const dec = (v: number | null) => (v === null ? '–' : v.toLocaleString('en-GB', { maximumFractionDigits: 1 }))

function LabResult({ result, realAvg, name }: { result: Distribution; realAvg: number | null; name: string }) {
  const bins = [...result.byTurn.filter((b) => b.turn >= 2 && b.turn <= 10), { turn: 0, share: result.never + result.byTurn.filter((b) => b.turn > 10).reduce((s, b) => s + b.share, 0) }]
  const max = Math.max(...bins.map((b) => b.share))
  const peak = bins.find((b) => b.share === max)

  return (
    <div className="lab-result">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-label">Avg. commander turn</span>
          <strong className="stat-value">{dec(result.average)}</strong>
          <span className="stat-sub">In real games: {dec(realAvg)}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">By turn 5</span>
          <strong className="stat-value">{pct(result.byTurnFive)}</strong>
          <span className="stat-sub">Avg. {dec(result.avgMulligans)} mulligans</span>
        </div>
      </div>

      <figure className="histogram" aria-label={`Distribution: which turn ${name} lands`}>
        <div className="histogram-bars">
          {bins.map((b) => (
            <div key={b.turn} className="histogram-col" title={`${b.turn ? `Turn ${b.turn}` : 'later/never'}: ${pct(b.share)}`}>
              {b === peak && <span className="histogram-peak">{pct(b.share)}</span>}
              <div className="histogram-bar" style={{ height: `${max ? (b.share / max) * 100 : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="histogram-axis" aria-hidden="true">
          {bins.map((b) => (
            <span key={b.turn}>{b.turn ? b.turn : '11+'}</span>
          ))}
        </div>
        <figcaption className="muted small">{name}’s turn in {result.games.toLocaleString('en-GB')} simulated games (no opponents).</figcaption>
      </figure>

      <details className="lab-table">
        <summary>Values as a table</summary>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Turn</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((b) => (
              <tr key={b.turn}>
                <td>{b.turn ? b.turn : '11 or never'}</td>
                <td>{pct(b.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="muted small">
        The autopilot plays a land every turn, ramp first, then the biggest creatures, and casts {name} as soon as it
        can. Spells and opponents are left out. A guideline, not an oracle.
      </p>
    </div>
  )
}

export function TrainingEmpty() {
  return <EmptyState title="Lesson not found" text="This lesson doesn't exist." />
}
