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
  { id: 3, label: 'Gut umgesetzt', icon: SmileyIcon, style: { '--c': 'var(--win)' } as CSSProperties },
  { id: 2, label: 'Teilweise', icon: SmileyMehIcon, style: { '--c': 'var(--fire)' } as CSSProperties },
  { id: 1, label: 'Kaum dran gedacht', icon: SmileySadIcon, style: { '--c': 'var(--loss)' } as CSSProperties },
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

/** Ist die Frage noch unbeantwortet? Dann heißt der Button „Überspringen“. */
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

/** Nach dem Spiel: eine Frage pro Bildschirm, wie bei Duolingo. */
export function RoundEnd() {
  const { draft, games } = useData()
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
    }),
    [games],
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
  /** Bei Einfachauswahl automatisch weiter: spart einen Tipp. */
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
        <Question title="Wie lief die Runde?">
          <div className="result-options">
            <ResultOption
              icon={TrophyIcon}
              label="Gewonnen"
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
              label="Verloren"
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
        <Question title="Wer hat gewonnen?" hint="Name oder Commander">
          <input
            className="big-input"
            value={form.winner}
            autoFocus
            enterKeyHint="next"
            placeholder="z. B. Atraxa"
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
          title={form.result === 'win' ? 'Warum hast du gewonnen?' : `Warum hat ${form.winner.trim() || 'der Gewinner'} gewonnen?`}
          hint="Ein, zwei Sätze reichen."
        >
          <textarea
            className="big-input"
            rows={4}
            autoFocus
            value={form.whyWinner}
            placeholder="z. B. Hat unbemerkt Gift-Counter gestapelt."
            onChange={(e) => set({ whyWinner: e.target.value })}
          />
        </Question>
      )
      break
    case 'whyCategory':
      content = (
        <Question title="Woran lag es vor allem?" hint="Erst eigene Fehler prüfen. Pech kommt ganz zum Schluss.">
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
        <Question title="Welche eine Entscheidung würdest du anders treffen?">
          <textarea
            className="big-input"
            rows={3}
            autoFocus
            value={form.decision}
            placeholder="z. B. Früher den Spieler mit der Engine angreifen."
            onChange={(e) => set({ decision: e.target.value })}
          />
          <Group label="Zu welchem Skill gehört sie?" hint="Taucht ein Skill 3× auf, zeigt dir die App ein Muster.">
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
        <Question title="Karten-Check" hint="Nach 8 Spielen siehst du, welche Karten raus sollten.">
          <Group label="Welche Karten lagen tot auf der Hand?">
            <ChipInput
              values={form.deadCards}
              onChange={(v) => set({ deadCards: v })}
              suggestions={suggestions.cards}
              placeholder="Kartenname"
            />
          </Group>
          <Group label="Welche haben überperformt?">
            <ChipInput
              values={form.starCards}
              onChange={(v) => set({ starCards: v })}
              suggestions={suggestions.cards}
              placeholder="Kartenname"
            />
          </Group>
        </Question>
      )
      break
    case 'rating':
      content = (
        <Question title={`Wie gut hat dein Fokus „${focusName}“ geklappt?`}>
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
        <Question title="Noch ein paar Zahlen?" hint="Alles optional. Hilft der Statistik.">
          <div className="row">
            <Group label="Ghalta kam in Zug">
              <Stepper label="Ghalta-Zug" value={form.ghaltaTurn} min={1} max={30} onChange={(v) => set({ ghaltaTurn: v })} />
            </Group>
            <Group label="Mulligans">
              <Stepper label="Mulligans" value={form.mulligans} min={0} max={7} onChange={(v) => set({ mulligans: v })} />
            </Group>
          </div>
          <Group label="Board Wipe?">
            <Choice layout="list" options={WIPE_OPTIONS} value={form.wipe} allowNone onChange={(v) => set({ wipe: v })} />
          </Group>
          <label className="field">
            <span className="field-label">Was hätte jemand anders an deiner Stelle gemacht?</span>
            <textarea rows={2} value={form.feedback} onChange={(e) => set({ feedback: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Notizen</span>
            <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </Question>
      )
      break
  }

  return (
    <div className="screen flow">
      <header className="flow-header">
        <IconButton icon={index === 0 ? XIcon : CaretLeftIcon} label={index === 0 ? 'Zurück zum Spiel' : 'Zurück'} onClick={back} />
        <ProgressBar value={(index + 1) / steps.length} label={`Frage ${index + 1} von ${steps.length}`} />
      </header>

      <div className="question-wrap" key={step}>
        {content}
      </div>

      <footer className="flow-footer">
        {step === 'result' ? (
          <Button block disabled={!resultPicked} onClick={next}>
            Weiter
          </Button>
        ) : last ? (
          <Button block onClick={next}>
            Speichern
          </Button>
        ) : (
          <Button block variant={empty ? 'secondary' : 'primary'} onClick={next}>
            {empty ? 'Überspringen' : 'Weiter'}
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
