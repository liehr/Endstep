import { CaretLeftIcon, CaretRightIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { GameForm } from '../components/GameForm'
import { SkillBadge, skillStyle } from '../components/skills'
import { Button, ConfirmSheet, EmptyState, IconButton, ResultPill } from '../components/ui'
import { FOCUS_RATINGS, SKILL_BY_ID, WHY_LABEL, WIPE_LABEL } from '../lib/content'
import { formatDate } from '../lib/dates'
import { sortGames } from '../lib/focus'
import { navigate } from '../lib/route'
import { actions, useData } from '../lib/store'
import { toast } from '../lib/toast'
import type { Game, GameInput } from '../lib/types'

const monthFormat = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })

function groupByMonth(games: Game[]): [string, Game[]][] {
  const groups = new Map<string, Game[]>()
  for (const g of games) {
    const [y, m] = g.playedAt.split('-').map(Number)
    const key = monthFormat.format(new Date(y, m - 1, 1))
    groups.set(key, [...(groups.get(key) ?? []), g])
  }
  return [...groups.entries()]
}

export function History() {
  const { games, draft } = useData()
  const [confirmReplace, setConfirmReplace] = useState(false)

  const addPast = () => {
    actions.startDraft()
    navigate('/runde/ende')
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Verlauf</h1>
        {games.length > 0 && (
          <Button size="sm" variant="secondary" icon={PlusIcon} onClick={() => (draft ? setConfirmReplace(true) : addPast())}>
            Nachtragen
          </Button>
        )}
      </header>

      {games.length === 0 ? (
        <EmptyState title="Noch keine Runden" text="Starte deine erste Runde auf der Startseite oder trag eine vergangene nach.">
          <Button variant="secondary" icon={PlusIcon} onClick={addPast}>
            Runde nachtragen
          </Button>
        </EmptyState>
      ) : (
        groupByMonth(sortGames(games)).map(([month, list]) => (
          <section key={month} className="list-group">
            <h2 className="list-title">{month}</h2>
            <ul className="list">
              {list.map((g) => (
                <li key={g.id}>
                  <button type="button" className="list-row" onClick={() => navigate(`/spiel/${g.id}`)}>
                    <SkillBadge id={g.focus} size={44} />
                    <span className="list-row-text">
                      <strong>{formatDate(g.playedAt)}</strong>
                      <span className="muted small">
                        {SKILL_BY_ID[g.focus].name}
                        {g.result === 'loss' && g.winner && ` · ${g.winner}`}
                      </span>
                    </span>
                    <ResultPill result={g.result} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <ConfirmSheet
        open={confirmReplace}
        title="Laufende Runde ersetzen?"
        text="Es läuft gerade eine Runde. Wenn du jetzt eine vergangene nachträgst, wird die laufende verworfen."
        confirmLabel="Ersetzen"
        onConfirm={addPast}
        onClose={() => setConfirmReplace(false)}
      />
    </div>
  )
}

function Answer({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="answer">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function GameDetail({ id }: { id: string }) {
  const { games } = useData()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const game = games.find((g) => g.id === id)
  if (!game) return <NotFound />

  const rating = FOCUS_RATINGS.find((r) => r.id === game.focusRating)?.label
  const facts = [
    game.ghaltaTurn !== null && `Ghalta in Zug ${game.ghaltaTurn}`,
    game.mulligans !== null && `${game.mulligans} Mulligan${game.mulligans === 1 ? '' : 's'}`,
    game.wipe && WIPE_LABEL[game.wipe],
    `${game.players} Spieler`,
    `Bracket ${game.bracket}`,
  ].filter(Boolean)

  return (
    <div className="screen">
      <header className="screen-header">
        <IconButton icon={CaretLeftIcon} label="Zurück zum Verlauf" onClick={() => navigate('/verlauf')} />
        <IconButton icon={PencilSimpleIcon} label="Bearbeiten" onClick={() => navigate(`/spiel/${game.id}/bearbeiten`)} />
      </header>

      <div className={`detail-hero ${game.result}`}>
        <ResultPill result={game.result} />
        <h1>{formatDate(game.playedAt)}</h1>
        <p className="muted">
          {game.deck}
          {game.result === 'loss' && game.winner && ` · Gewinner: ${game.winner}`}
        </p>
      </div>

      <div className="focus-card" style={skillStyle(game.focus)}>
        <SkillBadge id={game.focus} size={44} />
        <div>
          <span className="eyebrow">Fokus</span>
          <p>
            <strong>{SKILL_BY_ID[game.focus].name}</strong>
            {rating && <span className="muted"> · {rating}</span>}
          </p>
        </div>
      </div>

      <dl className="answers">
        <Answer label="Warum hat der Gewinner gewonnen?">
          {game.whyWinner || <span className="muted">–</span>}
          {game.whyCategory && <span className="tag">{WHY_LABEL[game.whyCategory]}</span>}
        </Answer>
        <Answer label="Eine Entscheidung anders">
          {game.decision || <span className="muted">–</span>}
          {game.decisionSkill && <span className="tag">{SKILL_BY_ID[game.decisionSkill].name}</span>}
        </Answer>
        {(game.deadCards.length > 0 || game.starCards.length > 0) && (
          <Answer label="Karten">
            <div className="chip-list">
              {game.deadCards.map((c) => (
                <span key={`d-${c}`} className="chip dead">
                  {c}
                </span>
              ))}
              {game.starCards.map((c) => (
                <span key={`s-${c}`} className="chip star">
                  ★ {c}
                </span>
              ))}
            </div>
          </Answer>
        )}
        {game.feedback && <Answer label="Feedback vom Tisch">{game.feedback}</Answer>}
        {game.notes && <Answer label="Notizen">{game.notes}</Answer>}
      </dl>

      <p className="facts muted small">{facts.join(' · ')}</p>

      <Button variant="ghost" icon={TrashIcon} className="danger-text" onClick={() => setConfirmDelete(true)}>
        Runde löschen
      </Button>

      <ConfirmSheet
        open={confirmDelete}
        title="Runde löschen?"
        text="Das lässt sich nicht rückgängig machen."
        confirmLabel="Löschen"
        onConfirm={() => {
          actions.deleteGame(game.id)
          toast('Runde gelöscht')
          navigate('/verlauf', { replace: true })
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function toInput(game: Game): GameInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = game
  return input
}

export function GameEdit({ id }: { id: string }) {
  const { games } = useData()
  const game = games.find((g) => g.id === id)
  const [form, setForm] = useState<GameInput | null>(() => (game ? toInput(game) : null))
  if (!game || !form) return <NotFound />

  const save = () => {
    actions.updateGame(game.id, form)
    toast('Gespeichert')
    navigate(`/spiel/${game.id}`, { replace: true })
  }

  return (
    <div className="screen flow">
      <header className="flow-header">
        <IconButton icon={CaretLeftIcon} label="Abbrechen" onClick={() => history.back()} />
        <span className="flow-title">Runde bearbeiten</span>
      </header>
      <GameForm value={form} onChange={setForm} />
      <footer className="flow-footer">
        <Button block onClick={save}>
          Speichern
        </Button>
      </footer>
    </div>
  )
}

function NotFound() {
  return (
    <div className="screen">
      <EmptyState title="Nicht gefunden" text="Diese Runde gibt es nicht (mehr).">
        <Button variant="secondary" icon={CaretRightIcon} onClick={() => navigate('/verlauf', { replace: true })}>
          Zum Verlauf
        </Button>
      </EmptyState>
    </div>
  )
}
