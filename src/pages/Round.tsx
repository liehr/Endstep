import {
  ArrowRightIcon,
  BookOpenIcon,
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
import type { SkillId } from '../lib/types'

/** Vor dem Spiel: Fokus und Ansage am Tisch, ein großer Start-Button. */
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
        <IconButton icon={XIcon} label="Schließen" onClick={() => navigate('/', { replace: true })} />
      </header>

      <div className="intro">
        <SkillBadge id={skill} size={112} />
        <span className="eyebrow">Dein Fokus für diese Runde</span>
        <h1>{s.name}</h1>
        <p className="lead">{s.tip}</p>
      </div>

      <div className="task-card">
        <span className="eyebrow">Deine Aufgabe</span>
        <p>{s.task}</p>
      </div>

      {settings.tableIntro && (
        <div className="speech">
          <img src={`${import.meta.env.BASE_URL}pwa-64x64.png`} alt="" />
          <div className="speech-bubble">
            <span className="eyebrow">Am Tisch ansagen</span>
            <p>„{settings.tableIntro}“</p>
          </div>
        </div>
      )}

      <footer className="flow-footer">
        <Button block icon={PlayIcon} onClick={start}>
          Los geht’s
        </Button>
      </footer>
    </div>
  )
}

/** Während des Spiels: Erinnerungen, Ghalta-Rechner, Spickzettel. */
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
        <IconButton icon={XIcon} label="Runde verwerfen" onClick={() => setSheet('discard')} />
        <span className="flow-title">Runde läuft</span>
      </header>

      <div className="focus-card" style={skillStyle(focus.id)}>
        <SkillBadge id={focus.id} size={52} />
        <div>
          <span className="eyebrow">Fokus: {focus.name}</span>
          <p>{focus.task}</p>
        </div>
      </div>

      <div className="callout warn">
        <ShieldWarningIcon weight="fill" aria-hidden="true" />
        <p>
          <strong>Bevor du ausspielst:</strong> Was passiert, wenn jetzt ein Wrath kommt?
        </p>
      </div>

      <GhaltaCalculator />

      <div className="tiles">
        <button type="button" className="tile" onClick={() => setSheet('attack')}>
          <CrosshairIcon weight="fill" aria-hidden="true" />
          Wen angreifen?
        </button>
        <button type="button" className="tile" onClick={() => setSheet('rules')}>
          <BookOpenIcon weight="fill" aria-hidden="true" />
          Regeln
        </button>
      </div>

      <footer className="flow-footer">
        <Button block onClick={() => navigate('/runde/ende')}>
          Spiel beendet
        </Button>
      </footer>

      <BottomSheet open={sheet === 'attack'} onClose={() => setSheet(null)} title="Wen angreifen?">
        <AttackList />
      </BottomSheet>
      <BottomSheet open={sheet === 'rules'} onClose={() => setSheet(null)} title="Regeln">
        <RulesList />
      </BottomSheet>
      <ConfirmSheet
        open={sheet === 'discard'}
        title="Runde verwerfen?"
        text="Die Runde wird nicht gespeichert. Notizen, die du schon gemacht hast, gehen verloren."
        confirmLabel="Verwerfen"
        onConfirm={() => {
          actions.discardDraft()
          navigate('/', { replace: true })
        }}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}

/** Nach dem Speichern: kurz feiern, Serie zeigen, nächsten Fokus ankündigen. */
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
        <h1>{won ? 'Gewonnen!' : 'Runde notiert!'}</h1>
        <p className="lead">
          {won ? 'Stark gespielt. Und du weißt jetzt auch, warum.' : 'Jede Niederlage ist ein Lernspiel. Genau so wirst du besser.'}
        </p>
      </div>

      <div className="reward-tiles">
        <div className="reward streak">
          <span className="reward-title">Serie</span>
          <span className="reward-value">
            <FireIcon weight="fill" aria-hidden="true" />
            {streak.current} {streak.current === 1 ? 'Woche' : 'Wochen'}
          </span>
        </div>
        <div className="reward rounds">
          <span className="reward-title">Runden</span>
          <span className="reward-value">
            <CardsIcon weight="fill" aria-hidden="true" />
            {games.length}
          </span>
        </div>
      </div>

      <div className="focus-card" style={skillStyle(next.id)}>
        <SkillBadge id={next.id} size={52} />
        <div>
          <span className="eyebrow">Nächstes Mal</span>
          <p>
            <strong>{next.name}</strong>
          </p>
        </div>
      </div>

      <footer className="flow-footer">
        <Button block icon={ArrowRightIcon} onClick={() => navigate('/', { replace: true })}>
          Weiter
        </Button>
      </footer>
    </div>
  )
}
