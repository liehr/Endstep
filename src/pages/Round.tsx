import { useEffect } from 'react'
import { GameForm } from '../components/GameForm'
import { GhaltaCalculator } from '../components/GhaltaCalculator'
import { Card, Choice, Collapsible, Group } from '../components/ui'
import { ATTACK_PRIORITIES, RULES, SKILLS, SKILL_BY_ID } from '../lib/content'
import { navigate } from '../lib/route'
import { actions, useData } from '../lib/store'
import { toast } from '../lib/toast'

const SKILL_OPTIONS = SKILLS.map((s) => ({ id: s.id, label: s.name }))

/** Vor und während des Spiels: Fokus, Ansage am Tisch, Spickzettel, Ghalta-Rechner. */
export function Round() {
  const { draft, settings } = useData()

  useEffect(() => {
    if (!draft) navigate('/', { replace: true })
  }, [draft])
  if (!draft) return null

  const focus = SKILL_BY_ID[draft.form.focus]

  const discard = () => {
    if (confirm('Laufende Runde verwerfen? Die Notizen dazu gehen verloren.')) {
      actions.discardDraft()
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Runde läuft</h1>
      </header>

      <Card className="highlight">
        <span className="eyebrow">Dein Fokus heute</span>
        <h2>{focus.name}</h2>
        <p>{focus.tip}</p>
        <p>
          <strong>Aufgabe:</strong> {focus.task}
        </p>
        <Collapsible title="Anderen Fokus wählen">
          <Group label="Fokus-Skill">
            <Choice
              options={SKILL_OPTIONS}
              value={draft.form.focus}
              onChange={(v) => v && actions.updateDraft({ ...draft.form, focus: v })}
              columns={2}
            />
          </Group>
        </Collapsible>
      </Card>

      {settings.tableIntro && (
        <Card>
          <span className="eyebrow">Vor dem Spiel am Tisch sagen</span>
          <p className="quote">„{settings.tableIntro}“</p>
        </Card>
      )}

      <Card className="warning">
        <p>
          <strong>Bevor du mehr Karten ausspielst:</strong> Was passiert, wenn jetzt ein Wrath kommt?
        </p>
      </Card>

      <GhaltaCalculator />

      <Card>
        <Collapsible title="Wen angreifen?">
          <ol>
            {ATTACK_PRIORITIES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </Collapsible>
        <Collapsible title="Regeln zum Nachschlagen">
          <dl className="rules">
            {RULES.map((r) => (
              <div key={r.title}>
                <dt>{r.title}</dt>
                <dd>{r.text}</dd>
              </div>
            ))}
          </dl>
        </Collapsible>
      </Card>

      <div className="sticky-actions">
        <button type="button" className="primary big" onClick={() => navigate('/runde/ende')}>
          Spiel beendet: Notieren
        </button>
        <button type="button" className="text danger" onClick={discard}>
          Runde verwerfen
        </button>
      </div>
    </div>
  )
}

/** Nach dem Spiel: die drei Fragen (2 Minuten). */
export function RoundEnd() {
  const { draft } = useData()

  useEffect(() => {
    if (!draft) navigate('/', { replace: true })
  }, [draft])
  if (!draft) return null

  const save = () => {
    const id = actions.finishDraft(draft.form)
    toast('Runde gespeichert.')
    navigate(`/spiel/${id}`, { replace: true })
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Nach dem Spiel</h1>
        <p className="muted">Zwei Minuten, drei Fragen. Alles außer dem Ergebnis ist optional.</p>
      </header>
      <GameForm value={draft.form} onChange={(form) => actions.updateDraft(form)} />
      <div className="sticky-actions">
        <button type="button" className="primary big" onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  )
}
