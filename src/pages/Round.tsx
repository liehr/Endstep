import {
  ArrowRightIcon,
  BookOpenIcon,
  CaretDoubleRightIcon,
  CardsIcon,
  CrosshairIcon,
  FireIcon,
  PlayIcon,
  ShieldWarningIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Confetti } from '../components/Confetti'
import { GhaltaCalculator } from '../components/GhaltaCalculator'
import { AttackList, RulesList } from '../components/Reference'
import { SkillBadge, skillStyle } from '../components/skills'
import { BottomSheet, Button, ConfirmSheet, IconButton } from '../components/ui'
import { SKILL_BY_ID } from '../lib/content'
import { today } from '../lib/dates'
import { nextFocus } from '../lib/focus'
import { haptic } from '../lib/haptics'
import { navigate } from '../lib/route'
import { weekStreak } from '../lib/streak'
import { actions, useData } from '../lib/store'
import { toast } from '../lib/toast'
import type { SkillId } from '../lib/types'

/** Before the game: focus and table announcement, one big start button. */
export function RoundStart({ skill }: { skill: SkillId }) {
  const { settings, draft } = useData()
  const s = SKILL_BY_ID[skill]

  useEffect(() => {
    if (draft) navigate('/runde', { replace: true })
  }, [draft])

  const start = () => {
    actions.startDraft(skill)
    navigate('/runde', { replace: true })
  }

  return (
    <div className="screen flow" style={skillStyle(skill)}>
      <header className="flow-header">
        <IconButton icon={XIcon} label="Close" onClick={() => navigate('/', { replace: true })} />
      </header>

      <div className="intro">
        <SkillBadge id={skill} size={112} />
        <span className="eyebrow">Your focus for this game</span>
        <h1>{s.name}</h1>
        <p className="lead">{s.tip}</p>
      </div>

      <div className="task-card">
        <span className="eyebrow">Your task</span>
        <p>{s.task}</p>
      </div>

      {settings.tableIntro && (
        <div className="speech">
          <img src={`${import.meta.env.BASE_URL}pwa-64x64.png`} alt="" />
          <div className="speech-bubble">
            <span className="eyebrow">Say it at the table</span>
            <p>"{settings.tableIntro}"</p>
          </div>
        </div>
      )}

      <footer className="flow-footer">
        <Button block icon={PlayIcon} onClick={start}>
          Let’s go
        </Button>
      </footer>
    </div>
  )
}

/** During the game: reminders, Ghalta calculator, cheat sheet. */
export function Round() {
  const { draft } = useData()
  const [sheet, setSheet] = useState<'attack' | 'rules' | 'discard' | null>(null)

  useEffect(() => {
    if (!draft) navigate('/', { replace: true })
  }, [draft])
  if (!draft) return null

  const focus = SKILL_BY_ID[draft.form.focus]

  return (
    <div className="screen flow">
      <header className="flow-header">
        <IconButton icon={XIcon} label="Discard game" onClick={() => setSheet('discard')} />
        <span className="flow-title">Game in progress</span>
      </header>

      <div className="focus-card" style={skillStyle(focus.id)}>
        <SkillBadge id={focus.id} size={52} />
        <div>
          <span className="eyebrow">Focus: {focus.name}</span>
          <p>{focus.task}</p>
        </div>
      </div>

      <div className="callout warn">
        <ShieldWarningIcon weight="fill" aria-hidden="true" />
        <p>
          <strong>Before you commit:</strong> What happens if a wrath hits right now?
        </p>
      </div>

      <TurnCard />

      <GhaltaCalculator
        value={draft.tracker}
        onChange={({ power, casts }) => actions.updateTracker({ ...draft.tracker, power, casts })}
      />

      <div className="tiles">
        <button type="button" className="tile" onClick={() => setSheet('attack')}>
          <CrosshairIcon weight="fill" aria-hidden="true" />
          Who to attack?
        </button>
        <button type="button" className="tile" onClick={() => setSheet('rules')}>
          <BookOpenIcon weight="fill" aria-hidden="true" />
          Rules
        </button>
      </div>

      <footer className="flow-footer">
        <Button
          block
          onClick={() => {
            const { form, tracker } = draft
            if (form.turns === null && tracker.turn > 1) actions.updateDraft({ ...form, turns: tracker.turn })
            navigate('/runde/ende')
          }}
        >
          End game
        </Button>
      </footer>

      <BottomSheet open={sheet === 'attack'} onClose={() => setSheet(null)} title="Who to attack?">
        <AttackList />
      </BottomSheet>
      <BottomSheet open={sheet === 'rules'} onClose={() => setSheet(null)} title="Rules">
        <RulesList />
      </BottomSheet>
      <ConfirmSheet
        open={sheet === 'discard'}
        title="Discard game?"
        text="The game won’t be saved. Any notes you’ve already made will be lost."
        confirmLabel="Discard"
        onConfirm={() => {
          actions.discardDraft()
          navigate('/', { replace: true })
        }}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}

/** Turn counter: "Next turn" and "Ghalta cast!" fill in the numbers for your notes right away. */
function TurnCard() {
  const { draft } = useData()
  if (!draft) return null
  const { tracker, form } = draft

  const nextTurn = () => {
    const turn = tracker.turn + 1
    haptic(10)
    actions.updateDraft({ ...form, turns: turn }, { ...tracker, turn })
    toast(`Turn ${turn}: What happens if a wrath hits right now?`)
  }

  const ghaltaCast = () => {
    haptic([12, 50, 12])
    actions.updateDraft(
      { ...form, ghaltaTurn: form.ghaltaTurn ?? tracker.turn, turns: Math.max(form.turns ?? 1, tracker.turn) },
      { ...tracker, casts: tracker.casts + 1 },
    )
    toast(form.ghaltaTurn === null ? `Ghalta on turn ${tracker.turn}! Noted.` : 'Ghalta cast again: tax +2.')
  }

  return (
    <section className="turn-card" aria-label="Turn counter">
      <div className="turn-number">
        <span className="eyebrow">Turn</span>
        <strong aria-live="polite">{tracker.turn}</strong>
      </div>
      <div className="turn-actions">
        <Button icon={CaretDoubleRightIcon} onClick={nextTurn}>
          Next turn
        </Button>
        <Button variant="secondary" size="sm" onClick={ghaltaCast}>
          {form.ghaltaTurn === null ? 'Ghalta cast!' : `Ghalta: turn ${form.ghaltaTurn} · again?`}
        </Button>
      </div>
    </section>
  )
}

/** After saving: celebrate briefly, show the streak, announce the next focus. */
export function RoundDone({ id }: { id: string }) {
  const { games } = useData()
  const game = games.find((g) => g.id === id)

  useEffect(() => {
    if (game) haptic([12, 60, 12])
    else navigate('/', { replace: true })
  }, [game])

  if (!game) return null

  const streak = weekStreak(games, today())
  const next = SKILL_BY_ID[nextFocus(games)]
  const won = game.result === 'win'

  return (
    <div className="screen flow done">
      <Confetti />
      <div className="intro">
        <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className="mascot bounce" />
        <h1>{won ? 'You won!' : 'Game logged!'}</h1>
        <p className="lead">
          {won ? 'Well played. And now you know why, too.' : 'Every loss is a lesson. That’s exactly how you get better.'}
        </p>
      </div>

      <div className="reward-tiles">
        <div className="reward streak">
          <span className="reward-title">Streak</span>
          <span className="reward-value">
            <FireIcon weight="fill" aria-hidden="true" />
            {streak.current} {streak.current === 1 ? 'week' : 'weeks'}
          </span>
        </div>
        <div className="reward rounds">
          <span className="reward-title">Games</span>
          <span className="reward-value">
            <CardsIcon weight="fill" aria-hidden="true" />
            {games.length}
          </span>
        </div>
      </div>

      <div className="focus-card" style={skillStyle(next.id)}>
        <SkillBadge id={next.id} size={52} />
        <div>
          <span className="eyebrow">Next time</span>
          <p>
            <strong>{next.name}</strong>
          </p>
        </div>
      </div>

      <footer className="flow-footer">
        <Button block icon={ArrowRightIcon} onClick={() => navigate('/', { replace: true })}>
          Continue
        </Button>
      </footer>
    </div>
  )
}
