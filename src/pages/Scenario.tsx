import { ArrowClockwiseIcon, ArrowRightIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Mana } from '../components/CardFrame'
import { CardGrid, PickCardGrid, type PickState } from '../components/CardImage'
import { Confetti } from '../components/Confetti'
import { Button, IconButton, ProgressBar } from '../components/ui'
import { boardPower, isCreature, isLand, type CardInfo } from '../lib/cards'
import { shortName } from '../lib/commander'
import { haptic } from '../lib/haptics'
import { describeTurn } from '../lib/quiz/quiz'
import { navigate } from '../lib/route'
import { buildLibrary, commanderCostLabel, simCommander } from '../lib/sim/goldfish'
import { randomSeed } from '../lib/sim/rng'
import {
  blockedReason,
  castCommander,
  endTurn,
  playCard,
  SCENARIO_TURNS,
  scenarioOver,
  scenarioResult,
  startScenario,
  type Scenario as ScenarioState,
} from '../lib/sim/scenario'
import { actions } from '../lib/store'
import { useDeckCards } from '../lib/useDeckCards'
import { LESSON_ICON, lessonStyle } from './Training'

/** Turn by turn: you play a goldfish game yourself and race the autopilot to your commander. */
export function Scenario() {
  const deck = useDeckCards({ autoLoad: false })
  const commanderCard = deck.lookup(deck.commander)
  const library = useMemo(() => buildLibrary(deck.decklist, deck.lookup), [deck.decklist, deck.lookup])
  const start = () => (commanderCard ? startScenario(library, simCommander(commanderCard), randomSeed()) : null)
  const [scenario, setScenario] = useState<ScenarioState | null>(start)
  const [selected, setSelected] = useState<number | null>(null)
  // The game mutates in place; this counter re-renders after each step.
  const [, setStep] = useState(0)
  const [recorded, setRecorded] = useState(false)

  if (!scenario || !commanderCard) {
    navigate('/training', { replace: true })
    return null
  }
  const s = scenario
  const name = shortName(deck.commander)
  const refresh = () => {
    setSelected(null)
    setStep((n) => n + 1)
  }
  const again = () => {
    setScenario(start())
    setRecorded(false)
    refresh()
  }

  if (scenarioOver(s)) {
    const result = scenarioResult(s, name)
    if (!recorded) {
      actions.addTrainingResult('scenario', result.score, 5)
      setRecorded(true)
    }
    return <ScenarioDone scenario={s} name={name} onAgain={again} />
  }

  const { game } = s
  const hand = game.hand
  const card = selected !== null ? hand[selected] : null
  const reason = card ? blockedReason(s, card) : null
  const permanents = game.board.filter((p) => !isLand(p.card))
  const lands = game.board.filter((p) => isLand(p.card))
  const forests = lands.filter((p) => /\bForest\b/.test(p.card.typeLine)).length
  const handStates: PickState[] = hand.map((c, i) => (i === selected ? 'selected' : blockedReason(s, c) ? 'dim' : ''))

  const act = () => {
    if (!card || reason) return
    haptic(12)
    playCard(s, card)
    refresh()
  }
  const commander = () => {
    haptic([12, 60, 12])
    castCommander(s)
    refresh()
  }
  const next = () => {
    haptic()
    endTurn(s)
    refresh()
    window.scrollTo(0, 0)
  }

  return (
    <div className="screen flow lesson scenario" style={lessonStyle('scenario')}>
      <header className="flow-header">
        <IconButton icon={XIcon} label="End scenario" onClick={() => navigate('/training')} />
        <ProgressBar value={(game.turn - 1) / SCENARIO_TURNS} label={`Turn ${game.turn} of ${SCENARIO_TURNS}`} />
      </header>

      <div className="question-wrap" key={game.turn}>
        <div className="question">
          <span className="eyebrow">Turn {game.turn}</span>
          <h1>Cast {name} as early as you can.</h1>
          <p className="muted">
            {s.current.drew ? `You drew ${s.current.drew}. ` : ''}Play a land, cast ramp and creatures, then end your turn. No opponents.
          </p>
          <div className="scenario-stats" role="status">
            <div className="stat-tile">
              <span className="stat-label">Mana left</span>
              <strong className="stat-value">{game.pool.length}</strong>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Power</span>
              <strong className="stat-value">{game.totalPower()}</strong>
            </div>
            <div className="stat-tile">
              <span className="stat-label">{name} costs</span>
              <strong className="stat-value">
                <Mana cost={commanderCostLabel(s.commander, game.totalPower())} />
              </strong>
            </div>
          </div>

          <div className="question-body">
            <section className="card-grid-wrap" aria-label="Battlefield">
              <span className="eyebrow">Battlefield</span>
              <p className="small muted">
                {lands.length ? `${lands.length} land${lands.length > 1 ? 's' : ''}: ${landSummary(lands.map((l) => l.card.name))}` : 'No lands yet.'}
              </p>
              {permanents.length > 0 && (
                <CardGrid
                  compact
                  cards={permanents.map((p) => ({
                    name: p.card.name,
                    caption: isCreature(p.card) ? `${ptOnBoard(p.card, forests)}${p.sick ? ' · new' : ''}` : 'Mana rock',
                  }))}
                />
              )}
            </section>

            <section className="card-grid-wrap" aria-label="Your hand">
              <span className="eyebrow">Your hand</span>
              <PickCardGrid className="hand-grid" cards={hand.map((c) => ({ name: c.name }))} states={handStates} disabled={false} onToggle={(i) => setSelected(i === selected ? null : i)} />
            </section>
          </div>
        </div>
      </div>

      <footer className="flow-footer">
        {card ? (
          <>
            {reason && <p className="footer-note small">{reason}</p>}
            <div className="scenario-actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Back
              </Button>
              <Button disabled={reason !== null} onClick={act}>
                {card.info && isLand(card.info) ? 'Play land' : 'Cast'}
              </Button>
            </div>
          </>
        ) : (
          <div className="scenario-actions">
            <Button variant="secondary" onClick={next}>
              End turn
            </Button>
            <Button disabled={!game.canCastCommander()} onClick={commander}>
              Cast {name}
            </Button>
          </div>
        )}
      </footer>
    </div>
  )
}

/** Power/toughness right now (Dungrove Elder counts your Forests). */
function ptOnBoard(card: CardInfo, forests: number): string {
  const power = boardPower(card, forests)
  return `${power}/${card.toughness === '*' ? power : card.toughness}`
}

/** "Forest ×3, Tranquil Thicket" */
function landSummary(names: string[]): string {
  const counts = new Map<string, number>()
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  return [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(', ')
}

function ScenarioDone({ scenario: s, name, onAgain }: { scenario: ScenarioState; name: string; onAgain: () => void }) {
  const IconCmp = LESSON_ICON.scenario
  const result = scenarioResult(s, name)
  useEffect(() => haptic([12, 60, 12]), [])
  const turnLabel = (t: number | null) => (t === null ? '–' : `Turn ${t}`)
  const commanderName = s.commander.name
  return (
    <div className="screen flow done" style={lessonStyle('scenario')}>
      {result.score === 5 && <Confetti />}
      <div className="intro">
        <span className="lesson-icon big" aria-hidden="true">
          <IconCmp weight="fill" />
        </span>
        <h1>{result.yours === null ? `No ${name} this time` : `${name} on turn ${result.yours}!`}</h1>
        <p className="lead">{result.verdict}</p>
      </div>
      <div className="reward-tiles">
        <div className="reward rounds">
          <span className="reward-title">You</span>
          <span className="reward-value">{turnLabel(result.yours)}</span>
        </div>
        <div className="reward streak">
          <span className="reward-title">Autopilot</span>
          <span className="reward-value">{turnLabel(result.autopilot)}</span>
        </div>
      </div>
      {s.tips.length > 0 && (
        <section className="panel">
          <h2>What you could do better</h2>
          <ul className="scenario-tips">
            {s.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}
      <details className="feedback-details panel">
        <summary>Your turns</summary>
        <ol>
          {s.log.map((t) => (
            <li key={t.turn}>{describeTurn(t, commanderName)}</li>
          ))}
        </ol>
      </details>
      <details className="feedback-details panel">
        <summary>The autopilot’s turns</summary>
        <ol>
          {s.autopilot.log.map((t) => (
            <li key={t.turn}>{describeTurn(t, commanderName)}</li>
          ))}
        </ol>
      </details>
      <footer className="flow-footer stack">
        <Button block icon={ArrowRightIcon} onClick={() => navigate('/training', { replace: true })}>
          Continue
        </Button>
        <Button block variant="secondary" icon={ArrowClockwiseIcon} onClick={onAgain}>
          New hand
        </Button>
      </footer>
    </div>
  )
}
