import { HeartBreakIcon, TrophyIcon } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { FOCUS_RATINGS, SKILLS, WHY_CATEGORIES, WIPE_OPTIONS } from '../lib/content'
import { deckCardNames } from '../lib/decklist'
import { tallyCards } from '../lib/stats'
import { useData } from '../lib/store'
import type { Bracket, GameInput } from '../lib/types'
import { SKILL_ICON, skillStyle } from './skills'
import { ChipInput, Choice, Field, Group, Stepper } from './ui'

const BRACKET_OPTIONS = ([1, 2, 3, 4, 5] as Bracket[]).map((b) => ({ id: b, label: String(b) }))
const SKILL_OPTIONS = SKILLS.map((s) => ({ id: s.id, label: s.name, icon: SKILL_ICON[s.id], style: skillStyle(s.id) }))

/** Alle Felder einer Runde auf einer Seite (zum nachträglichen Bearbeiten). */
export function GameForm({ value, onChange }: { value: GameInput; onChange: (value: GameInput) => void }) {
  const { games, decklist } = useData()
  const deckNames = useMemo(() => deckCardNames(decklist), [decklist])
  const set = <K extends keyof GameInput>(key: K, v: GameInput[K]) => onChange({ ...value, [key]: v })

  const cardSuggestions = useMemo(
    () => tallyCards(games.flatMap((g) => [g.deadCards, g.starCards])).map((t) => t.name),
    [games],
  )

  return (
    <div className="form">
      <section className="form-section">
        <h2>Ergebnis</h2>
        <Choice
          options={[
            { id: 'win', label: 'Gewonnen', icon: TrophyIcon },
            { id: 'loss', label: 'Verloren', icon: HeartBreakIcon },
          ]}
          value={value.result}
          onChange={(v) => v && set('result', v)}
        />
        {value.result === 'loss' && (
          <Field label="Wer hat gewonnen?">
            <input value={value.winner} onChange={(e) => set('winner', e.target.value)} />
          </Field>
        )}
      </section>

      <section className="form-section">
        <h2>Die drei Fragen</h2>
        <Field label="Warum hat der Gewinner gewonnen?">
          <textarea rows={3} value={value.whyWinner} onChange={(e) => set('whyWinner', e.target.value)} />
        </Field>
        {value.result === 'loss' && (
          <Group label="Woran lag es?">
            <Choice layout="list" options={WHY_CATEGORIES} value={value.whyCategory} allowNone onChange={(v) => set('whyCategory', v)} />
          </Group>
        )}
        <Field label="Welche eine Entscheidung würdest du anders treffen?">
          <textarea rows={3} value={value.decision} onChange={(e) => set('decision', e.target.value)} />
        </Field>
        <Group label="Zu welchem Skill gehört sie?">
          <Choice options={SKILL_OPTIONS} value={value.decisionSkill} allowNone onChange={(v) => set('decisionSkill', v)} />
        </Group>
        <Group label="Tote Karten">
          <ChipInput values={value.deadCards} onChange={(v) => set('deadCards', v)} suggestions={cardSuggestions} catalog={deckNames} placeholder="Kartenname" />
        </Group>
        <Group label="Überperformer">
          <ChipInput values={value.starCards} onChange={(v) => set('starCards', v)} suggestions={cardSuggestions} catalog={deckNames} placeholder="Kartenname" />
        </Group>
      </section>

      <section className="form-section">
        <h2>Fokus</h2>
        <Choice options={SKILL_OPTIONS} value={value.focus} onChange={(v) => v && set('focus', v)} />
        <Group label="Wie gut hat er geklappt?">
          <Choice options={FOCUS_RATINGS} value={value.focusRating} allowNone columns={3} onChange={(v) => set('focusRating', v)} />
        </Group>
      </section>

      <section className="form-section">
        <h2>Details</h2>
        <div className="row">
          <Group label="Ghalta kam in Zug">
            <Stepper label="Ghalta-Zug" value={value.ghaltaTurn} min={1} max={30} onChange={(v) => set('ghaltaTurn', v)} />
          </Group>
          <Group label="Mulligans">
            <Stepper label="Mulligans" value={value.mulligans} min={0} max={7} onChange={(v) => set('mulligans', v)} />
          </Group>
        </div>
        <Group label="Züge gesamt">
          <Stepper label="Züge" value={value.turns} min={1} max={40} onChange={(v) => set('turns', v)} />
        </Group>
        <Group label="Board Wipe?">
          <Choice layout="list" options={WIPE_OPTIONS} value={value.wipe} allowNone onChange={(v) => set('wipe', v)} />
        </Group>
        <Field label="Feedback vom Tisch">
          <textarea rows={2} value={value.feedback} onChange={(e) => set('feedback', e.target.value)} />
        </Field>
        <Field label="Notizen">
          <textarea rows={2} value={value.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </section>

      <section className="form-section">
        <h2>Tisch</h2>
        <Field label="Datum">
          <input type="date" value={value.playedAt} onChange={(e) => e.target.value && set('playedAt', e.target.value)} />
        </Field>
        <Field label="Deck">
          <input value={value.deck} onChange={(e) => set('deck', e.target.value)} />
        </Field>
        <Group label="Bracket">
          <Choice options={BRACKET_OPTIONS} value={value.bracket} columns={5} onChange={(v) => v && set('bracket', v)} />
        </Group>
        <Group label="Spieler am Tisch">
          <Stepper label="Spieler" value={value.players} min={2} max={8} onChange={(v) => v && set('players', v)} />
        </Group>
      </section>
    </div>
  )
}
