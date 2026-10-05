import {
  ArrowsLeftRightIcon,
  BugIcon,
  CaretLeftIcon,
  DiceFiveIcon,
  EyeIcon,
  HeartBreakIcon,
  SmileyIcon,
  SmileyMehIcon,
  SmileySadIcon,
  StackIcon,
  TrophyIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { SKILL_ICON, skillStyle } from '../components/skills'
import { Button, ChipInput, Choice, Group, IconButton, ProgressBar, Stepper } from '../components/ui'
import { SKILLS, SKILL_BY_ID, WHY_CATEGORIES, WIPE_OPTIONS } from '../lib/content'
import { haptic } from '../lib/haptics'
import { deckCardNames } from '../lib/decklist'
import { navigate } from '../lib/route'
import { tallyCards } from '../lib/stats'
import { actions, useData } from '../lib/store'
import type { FocusRating, GameInput, WhyCategory } from '../lib/types'

type StepId = 'result' | 'winner' | 'why' | 'whyCategory' | 'decision' | 'cards' | 'rating' | 'details'

const WHY_ICONS: Record<WhyCategory, Icon> = {
  mistake: BugIcon,
  foresee: EyeIcon,
  deckbuilding: StackIcon,
  wrongdeck: ArrowsLeftRightIcon,
  luck: DiceFiveIcon,
}

const RATING_OPTIONS: { id: FocusRating; label: string; icon: Icon; style: CSSProperties }[] = [
  { id: 3, label: 'Nailed it', icon: SmileyIcon, style: { '--c': 'var(--win)' } as CSSProperties },
  { id: 2, label: 'Partly', icon: SmileyMehIcon, style: { '--c': 'var(--fire)' } as CSSProperties },
  { id: 1, label: 'Barely thought of it', icon: SmileySadIcon, style: { '--c': 'var(--loss)' } as CSSProperties },
]

function stepsFor(form: GameInput): StepId[] {
  const loss = form.result === 'loss'
  return [
    'result',
    ...(loss ? (['winner'] as const) : []),
    'why',
    ...(loss ? (['whyCategory'] as const) : []),
    'decision',
    'cards',
    'rating',
    'details',
  ]
}

/** Is the question still unanswered? Then the button says "Skip". */
function isEmpty(step: StepId, form: GameInput): boolean {
  switch (step) {
    case 'winner':
      return !form.winner.trim()
    case 'why':
      return !form.whyWinner.trim()
    case 'whyCategory':
      return form.whyCategory === null
    case 'decision':
      return !form.decision.trim() && form.decisionSkill === null
    case 'cards':
      return form.deadCards.length === 0 && form.starCards.length === 0
    case 'rating':
      return form.focusRating === null
    default:
      return false
  }
}

/** After the game: one question per screen, like Duolingo. */
export function RoundEnd() {
  const { draft, games, decklist } = useData()
  const [index, setIndex] = useState(0)
  const [resultPicked, setResultPicked] = useState(false)
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!draft) navigate('/', { replace: true })
  }, [draft])
  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const suggestions = useMemo(
    () => ({
      cards: tallyCards(games.flatMap((g) => [g.deadCards, g.starCards])).map((t) => t.name),
      winners: [...new Set(games.map((g) => g.winner.trim()).filter(Boolean))].slice(0, 8),
      deck: deckCardNames(decklist),
    }),
    [games, decklist],
  )

  if (!draft) return null
  const form = draft.form
  const steps = stepsFor(form)
  const step = steps[Math.min(index, steps.length - 1)]
  const last = index >= steps.length - 1
  const set = (patch: Partial<GameInput>) => actions.updateDraft({ ...form, ...patch })

  const next = () => {
    clearTimeout(advanceTimer.current)
    if (last) {
      const id = actions.finishDraft(form)
      navigate(`/runde/fertig/${id}`, { replace: true })
    } else {
      setIndex((i) => i + 1)
      window.scrollTo(0, 0)
    }
  }
  /** Single choice advances automatically: saves a tap. */
  const autoAdvance = () => {
    clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(next, 280)
  }
  const back = () => {
    if (index > 0) setIndex((i) => i - 1)
    else if (history.length > 1) history.back()
    else navigate('/runde')
  }

  const empty = isEmpty(step, form)
  const focusName = SKILL_BY_ID[form.focus].name

  let content: ReactNode
  switch (step) {
    case 'result':
      content = (
        <Question title="How did the game go?">
          <div className="result-options">
            <ResultOption
              icon={TrophyIcon}
              label="Won"
              tone="win"
              selected={resultPicked && form.result === 'win'}
              onClick={() => {
                setResultPicked(true)
                set({ result: 'win' })
                autoAdvance()
              }}
            />
            <ResultOption
              icon={HeartBreakIcon}
              label="Lost"
              tone="loss"
              selected={resultPicked && form.result === 'loss'}
              onClick={() => {
                setResultPicked(true)
                set({ result: 'loss' })
                autoAdvance()
              }}
            />
          </div>
        </Question>
      )
      break
    case 'winner':
      content = (
        <Question title="Who won?" hint="Name or commander">
          <input
            className="big-input"
            value={form.winner}
            autoFocus
            enterKeyHint="next"
            placeholder="e.g. Atraxa"
            onChange={(e) => set({ winner: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && next()}
          />
          {suggestions.winners.length > 0 && (
            <ul className="chip-list suggestions">
              {suggestions.winners.map((w) => (
                <li key={w}>
                  <button type="button" className={`chip ${form.winner === w ? 'selected' : ''}`} onClick={() => set({ winner: w })}>
                    {w}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Question>
      )
      break
    case 'why':
      content = (
        <Question
          title={form.result === 'win' ? 'Why did you win?' : `Why did ${form.winner.trim() || 'the winner'} win?`}
          hint="A sentence or two is enough."
        >
          <textarea
            className="big-input"
            rows={4}
            autoFocus
            value={form.whyWinner}
            placeholder="e.g. Quietly stacked poison counters."
            onChange={(e) => set({ whyWinner: e.target.value })}
          />
        </Question>
      )
      break
    case 'whyCategory':
      content = (
        <Question title="What was the main reason?" hint="Check your own mistakes first. Bad luck comes last.">
          <Choice
            layout="list"
            options={WHY_CATEGORIES.map((c) => ({ ...c, icon: WHY_ICONS[c.id] }))}
            value={form.whyCategory}
            onChange={(v) => {
              set({ whyCategory: v })
              autoAdvance()
            }}
          />
        </Question>
      )
      break
    case 'decision':
      content = (
        <Question title="Which one decision would you make differently?">
          <textarea
            className="big-input"
            rows={3}
            autoFocus
            value={form.decision}
            placeholder="e.g. Attack the player with the engine sooner."
            onChange={(e) => set({ decision: e.target.value })}
          />
          <Group label="Which skill does it belong to?" hint="If a skill shows up 3×, the app shows you a pattern.">
            <Choice
              options={SKILLS.map((s) => ({ id: s.id, label: s.name, icon: SKILL_ICON[s.id], style: skillStyle(s.id) }))}
              value={form.decisionSkill}
              allowNone
              onChange={(v) => set({ decisionSkill: v })}
            />
          </Group>
        </Question>
      )
      break
    case 'cards':
      content = (
        <Question title="Card check" hint="After 8 games you’ll see which cards should go out.">
          <Group label="Which cards were dead in your hand?">
            <ChipInput
              values={form.deadCards}
              onChange={(v) => set({ deadCards: v })}
              suggestions={suggestions.cards}
              catalog={suggestions.deck}
              placeholder="Card name"
            />
          </Group>
          <Group label="Which ones overperformed?">
            <ChipInput
              values={form.starCards}
              onChange={(v) => set({ starCards: v })}
              suggestions={suggestions.cards}
              catalog={suggestions.deck}
              placeholder="Card name"
            />
          </Group>
        </Question>
      )
      break
    case 'rating':
      content = (
        <Question title={`How well did your focus "${focusName}" go?`}>
          <Choice
            layout="list"
            options={RATING_OPTIONS}
            value={form.focusRating}
            onChange={(v) => {
              set({ focusRating: v })
              autoAdvance()
            }}
          />
        </Question>
      )
      break
    case 'details':
      content = (
        <Question title="A few more numbers?" hint="All optional. Helps your stats.">
          <div className="row">
            <Group label="Commander landed on turn">
              <Stepper label="Commander turn" value={form.commanderTurn} min={1} max={30} onChange={(v) => set({ commanderTurn: v })} />
            </Group>
            <Group label="Mulligans">
              <Stepper label="Mulligans" value={form.mulligans} min={0} max={7} onChange={(v) => set({ mulligans: v })} />
            </Group>
          </div>
          <Group label="How many turns did the game last?" hint="Your own turns. Bracket 2 expects at least 8.">
            <Stepper label="Turns" value={form.turns} min={1} max={40} onChange={(v) => set({ turns: v })} />
          </Group>
          <Group label="Board Wipe?">
            <Choice layout="list" options={WIPE_OPTIONS} value={form.wipe} allowNone onChange={(v) => set({ wipe: v })} />
          </Group>
          <label className="field">
            <span className="field-label">What would someone else have done in your place?</span>
            <textarea rows={2} value={form.feedback} onChange={(e) => set({ feedback: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Notes</span>
            <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </Question>
      )
      break
  }

  return (
    <div className="screen flow">
      <header className="flow-header">
        <IconButton icon={index === 0 ? XIcon : CaretLeftIcon} label={index === 0 ? 'Back to game' : 'Back'} onClick={back} />
        <ProgressBar value={(index + 1) / steps.length} label={`Question ${index + 1} of ${steps.length}`} />
      </header>

      <div className="question-wrap" key={step}>
        {content}
      </div>

      <footer className="flow-footer">
        {step === 'result' ? (
          <Button block disabled={!resultPicked} onClick={next}>
            Continue
          </Button>
        ) : last ? (
          <Button block onClick={next}>
            Save
          </Button>
        ) : (
          <Button block variant={empty ? 'secondary' : 'primary'} onClick={next}>
            {empty ? 'Skip' : 'Continue'}
          </Button>
        )}
      </footer>
    </div>
  )
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="question">
      <h1>{title}</h1>
      {hint && <p className="muted">{hint}</p>}
      <div className="question-body">{children}</div>
    </div>
  )
}

function ResultOption({
  icon: IconCmp,
  label,
  tone,
  selected,
  onClick,
}: {
  icon: Icon
  label: string
  tone: 'win' | 'loss'
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`result-option ${tone} ${selected ? 'selected' : ''}`}
      onClick={() => {
        haptic()
        onClick()
      }}
    >
      <span className="result-icon">
        <IconCmp weight="fill" aria-hidden="true" />
      </span>
      {label}
    </button>
  )
}
