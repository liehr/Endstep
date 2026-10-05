import { useMemo } from 'react'
import { FOCUS_RATINGS, SKILLS, WHY_CATEGORIES, WIPE_OPTIONS } from '../lib/content'
import { tallyCards } from '../lib/stats'
import { useData } from '../lib/store'
import type { Bracket, GameInput } from '../lib/types'
import { ChipInput, Choice, Collapsible, Field, Group, Stepper } from './ui'

const BRACKET_OPTIONS = ([1, 2, 3, 4, 5] as Bracket[]).map((b) => ({ id: b, label: String(b) }))
const SKILL_OPTIONS = SKILLS.map((s) => ({ id: s.id, label: s.name }))

/** Das Nach-dem-Spiel-Formular: die drei Fragen zuerst, Details optional. */
export function GameForm({
  value,
  onChange,
}: {
  value: GameInput
  onChange: (value: GameInput) => void
}) {
  const { games } = useData()
  const set = <K extends keyof GameInput>(key: K, v: GameInput[K]) => onChange({ ...value, [key]: v })

  const suggestions = useMemo(() => {
    const cards = tallyCards(games.flatMap((g) => [g.deadCards, g.starCards])).map((t) => t.name)
    const winners = [...new Set(games.map((g) => g.winner.trim()).filter(Boolean))]
    const decks = [...new Set(games.map((g) => g.deck.trim()).filter(Boolean))]
    return { cards, winners, decks }
  }, [games])

  return (
    <div className="form">
      <Group label="Ergebnis">
        <Choice
          options={[
            { id: 'win', label: 'Gewonnen' },
            { id: 'loss', label: 'Verloren' },
          ]}
          value={value.result}
          onChange={(v) => v && set('result', v)}
        />
      </Group>

      {value.result === 'loss' && (
        <Field label="Wer hat gewonnen?" hint="Name oder Commander">
          <input
            value={value.winner}
            list="winner-suggestions"
            onChange={(e) => set('winner', e.target.value)}
          />
          <datalist id="winner-suggestions">
            {suggestions.winners.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </Field>
      )}

      <Field label="1. Warum hat der Gewinner gewonnen?">
        <textarea rows={3} value={value.whyWinner} onChange={(e) => set('whyWinner', e.target.value)} />
      </Field>

      {value.result === 'loss' && (
        <Group
          label="Woran lag es?"
          hint="In dieser Reihenfolge prüfen. Pech kommt erst ganz am Ende."
        >
          <Choice
            options={WHY_CATEGORIES}
            value={value.whyCategory}
            onChange={(v) => set('whyCategory', v)}
            allowNone
            columns={1}
          />
        </Group>
      )}

      <Field label="2. Welche eine Entscheidung würdest du anders treffen?">
        <textarea rows={3} value={value.decision} onChange={(e) => set('decision', e.target.value)} />
      </Field>

      <Group label="Zu welchem Skill gehört sie?" hint="Taucht ein Skill 3× auf, ist es ein Muster.">
        <Choice
          options={SKILL_OPTIONS}
          value={value.decisionSkill}
          onChange={(v) => set('decisionSkill', v)}
          allowNone
          columns={2}
        />
      </Group>

      <Group label="3. Welche Karten lagen tot auf der Hand?">
        <ChipInput
          values={value.deadCards}
          onChange={(v) => set('deadCards', v)}
          suggestions={suggestions.cards}
          placeholder="Kartenname"
        />
      </Group>

      <Group label="… und welche haben überperformt?">
        <ChipInput
          values={value.starCards}
          onChange={(v) => set('starCards', v)}
          suggestions={suggestions.cards}
          placeholder="Kartenname"
        />
      </Group>

      <Group label="Wie gut hat dein Fokus geklappt?">
        <Choice
          options={FOCUS_RATINGS}
          value={value.focusRating}
          onChange={(v) => set('focusRating', v)}
          allowNone
          columns={3}
        />
      </Group>

      <Collapsible title="Mehr Details (optional)">
        <Group label="Fokus-Skill dieser Runde">
          <Choice
            options={SKILL_OPTIONS}
            value={value.focus}
            onChange={(v) => v && set('focus', v)}
            columns={2}
          />
        </Group>
        <div className="row">
          <Group label="Ghalta kam in Zug">
            <Stepper label="Ghalta-Zug" value={value.ghaltaTurn} min={1} max={30} onChange={(v) => set('ghaltaTurn', v)} />
          </Group>
          <Group label="Mulligans">
            <Stepper label="Mulligans" value={value.mulligans} min={0} max={7} onChange={(v) => set('mulligans', v)} />
          </Group>
        </div>
        <Group label="Board Wipe?">
          <Choice
            options={WIPE_OPTIONS}
            value={value.wipe}
            onChange={(v) => set('wipe', v)}
            allowNone
            columns={1}
          />
        </Group>
        <Field label="Bonus: Was hätte jemand anders an deiner Stelle gemacht?">
          <textarea rows={2} value={value.feedback} onChange={(e) => set('feedback', e.target.value)} />
        </Field>
        <Field label="Notizen">
          <textarea rows={2} value={value.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <Field label="Datum">
          <input
            type="date"
            value={value.playedAt}
            onChange={(e) => e.target.value && set('playedAt', e.target.value)}
          />
        </Field>
        <Field label="Deck">
          <input
            value={value.deck}
            list="deck-suggestions"
            onChange={(e) => set('deck', e.target.value)}
          />
          <datalist id="deck-suggestions">
            {suggestions.decks.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <Group label="Bracket">
          <Choice options={BRACKET_OPTIONS} value={value.bracket} onChange={(v) => v && set('bracket', v)} columns={5} />
        </Group>
        <Group label="Spieler am Tisch">
          <Stepper label="Spieler" value={value.players} min={2} max={8} onChange={(v) => v && set('players', v)} />
        </Group>
      </Collapsible>
    </div>
  )
}
