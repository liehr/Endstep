import {
  ArrowClockwiseIcon,
  CardsIcon,
  CardsThreeIcon,
  CloudArrowDownIcon,
  CrosshairIcon,
  FlaskIcon,
  GraduationCapIcon,
  HourglassIcon,
  LockIcon,
  PlayIcon,
  SwordIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button, EmptyState } from '../components/ui'
import { LESSONS } from '../lib/quiz/quiz'
import { navigate } from '../lib/route'
import { buildLibrary, seedFor, simulateGame, summarize, type Distribution } from '../lib/sim/goldfish'
import { randomSeed } from '../lib/sim/rng'
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
}

/** Farben (mit passender Icon-Farbe) aus der geprüften Skill-Palette, damit alles zusammenpasst. */
const LESSON_SKILL: Record<LessonId, SkillId> = {
  ghalta: 'combat',
  combat: 'threat',
  rules: 'sequencing',
  mulligan: 'mulligan',
  goldfish: 'politics',
  cards: 'removal',
}

export const lessonStyle = (id: LessonId): CSSProperties => skillStyle(LESSON_SKILL[id])

/** Mindestens so viele Deckkarten müssen geladen sein, damit Simulationen Sinn ergeben. */
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
          <p className="muted">Kurze Lektionen für zwischen den Spieltagen.</p>
        </div>
      </header>

      {training.length > 0 && (
        <div className="stat-grid">
          <div className="stat-tile">
            <span className="stat-label">Lektionen</span>
            <strong className="stat-value">{training.length}</strong>
          </div>
          <div className="stat-tile">
            <span className="stat-label">Richtig</span>
            <strong className="stat-value">{Math.round((totalCorrect / totalAnswered) * 100)} %</strong>
            <span className="stat-sub">
              {totalCorrect} von {totalAnswered}
            </span>
          </div>
        </div>
      )}

      {!ready && <CardDataNotice deck={deck} />}

      <ul className="lessons">
        {LESSONS.map((lesson) => {
          const IconCmp = LESSON_ICON[lesson.id]
          const results = training.filter((t) => t.lessonId === lesson.id)
          const best = results.reduce((m, t) => Math.max(m, t.correct), 0)
          const locked = lesson.needsCards && !ready
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
                  <span className="muted small">{locked ? 'Braucht die Kartendaten deines Decks.' : lesson.description}</span>
                  {results.length > 0 && (
                    <span className="lesson-progress">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} className={i < best ? 'on' : ''} />
                      ))}
                      <span className="small muted">
                        {results.length}× gespielt
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

      {ready ? <GoldfishLab /> : null}
    </div>
  )
}

function CardDataNotice({ deck }: { deck: ReturnType<typeof useDeckCards> }) {
  const loading = deck.status === 'loading'
  return (
    <section className="panel notice">
      <h2>Kartendaten laden</h2>
      <p className="muted">
        Für den Mulligan-Trainer und die Simulation lädt Endstep einmalig die Karten deines Decks von Scryfall. Danach
        geht alles auch offline.
      </p>
      {deck.error && <p className="error-text">{deck.error}</p>}
      <Button icon={loading ? ArrowClockwiseIcon : CloudArrowDownIcon} disabled={loading} onClick={() => void deck.load(true)}>
        {loading ? 'Lädt…' : 'Karten laden'}
      </Button>
    </section>
  )
}

// --- Goldfish-Labor -----------------------------------------------------------------

const LAB_GAMES = 1000
const CHUNK = 100

function GoldfishLab() {
  const { games, settings, swaps } = useData()
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

  const realAvg = computeStats(games, settings.defaultDeck).avgGhaltaTurn

  const run = () => {
    const library = buildLibrary(deck.decklist, deck.lookup)
    const seed = randomSeed()
    const turns: (number | null)[] = []
    const mulligans: number[] = []
    setProgress(0)
    const step = () => {
      if (cancelled.current) return
      for (let i = turns.length; i < Math.min(LAB_GAMES, turns.length + CHUNK); i++) {
        const g = simulateGame(library, seedFor(seed, i))
        turns.push(g.ghaltaTurn)
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
          <h2>Goldfish-Labor</h2>
          <p className="muted small">
            {LAB_GAMES.toLocaleString('de-DE')} Spiele mit deinem aktuellen Deck{swaps.length ? ` (nach ${swaps.length} Swap-Runde${swaps.length > 1 ? 'n' : ''})` : ''}: Wann kommt
            Ghalta?
          </p>
        </div>
      </div>

      {progress !== null ? (
        <div className="lab-progress" role="status">
          <div className="progress">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="muted small">Simuliere… {Math.round(progress * 100)} %</span>
        </div>
      ) : (
        <Button variant={result ? 'secondary' : 'primary'} icon={result ? ArrowClockwiseIcon : PlayIcon} onClick={run}>
          {result ? 'Nochmal simulieren' : 'Simulation starten'}
        </Button>
      )}

      {result && <LabResult result={result} realAvg={realAvg} />}
    </section>
  )
}

const pct = (v: number) => `${Math.round(v * 100)} %`
const dec = (v: number | null) => (v === null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 1 }))

function LabResult({ result, realAvg }: { result: Distribution; realAvg: number | null }) {
  const bins = [...result.byTurn.filter((b) => b.turn >= 2 && b.turn <= 10), { turn: 0, share: result.never + result.byTurn.filter((b) => b.turn > 10).reduce((s, b) => s + b.share, 0) }]
  const max = Math.max(...bins.map((b) => b.share))
  const peak = bins.find((b) => b.share === max)

  return (
    <div className="lab-result">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-label">Ø Ghalta-Zug</span>
          <strong className="stat-value">{dec(result.average)}</strong>
          <span className="stat-sub">In echten Runden: {dec(realAvg)}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Bis Zug 5</span>
          <strong className="stat-value">{pct(result.byTurnFive)}</strong>
          <span className="stat-sub">Ø {dec(result.avgMulligans)} Mulligans</span>
        </div>
      </div>

      <figure className="histogram" aria-label="Verteilung: in welchem Zug Ghalta kommt">
        <div className="histogram-bars">
          {bins.map((b) => (
            <div key={b.turn} className="histogram-col" title={`${b.turn ? `Zug ${b.turn}` : 'später/nie'}: ${pct(b.share)}`}>
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
        <figcaption className="muted small">Ghalta-Zug in {result.games.toLocaleString('de-DE')} simulierten Spielen (ohne Gegner).</figcaption>
      </figure>

      <details className="lab-table">
        <summary>Werte als Tabelle</summary>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Zug</th>
              <th scope="col">Anteil</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((b) => (
              <tr key={b.turn}>
                <td>{b.turn ? b.turn : '11 oder nie'}</td>
                <td>{pct(b.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="muted small">
        Der Autopilot spielt jeden Zug ein Land, zuerst Manakreaturen, dann die stärksten Kreaturen, und castet Ghalta,
        sobald es geht. Zauber und Gegner bleiben außen vor. Ein Richtwert, kein Orakel.
      </p>
    </div>
  )
}

export function TrainingEmpty() {
  return <EmptyState title="Lektion nicht gefunden" text="Diese Lektion gibt es nicht." />
}
