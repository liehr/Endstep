import { useState, type ReactNode } from 'react'
import { GameForm } from '../components/GameForm'
import { Card, ResultBadge } from '../components/ui'
import { FOCUS_RATINGS, SKILL_BY_ID, WHY_LABEL, WIPE_LABEL } from '../lib/content'
import { formatDate } from '../lib/dates'
import { sortGames } from '../lib/focus'
import { navigate } from '../lib/route'
import { actions, useData } from '../lib/store'
import { toast } from '../lib/toast'
import type { Game, GameInput } from '../lib/types'

export function History() {
  const { games, draft } = useData()
  const sorted = sortGames(games)

  const addPast = () => {
    if (draft && !confirm('Es läuft gerade eine Runde. Trotzdem eine neue anlegen? Die laufende wird ersetzt.')) {
      return
    }
    actions.startDraft()
    navigate('/runde/ende')
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Verlauf</h1>
        <p className="muted">
          {games.length === 0 ? 'Noch keine Runden.' : `${games.length} Runden gespielt`}
        </p>
      </header>

      <button type="button" className="secondary block" onClick={addPast}>
        Runde nachtragen
      </button>

      {sorted.length > 0 && (
        <Card className="list">
          {sorted.map((g) => (
            <button key={g.id} type="button" className="list-item" onClick={() => navigate(`/spiel/${g.id}`)}>
              <span>
                <strong>{formatDate(g.playedAt)}</strong>
                <span className="muted small">
                  {SKILL_BY_ID[g.focus].name}
                  {g.result === 'loss' && g.winner && ` · Sieger: ${g.winner}`}
                </span>
              </span>
              <ResultBadge result={g.result} />
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function GameDetail({ id }: { id: string }) {
  const { games } = useData()
  const game = games.find((g) => g.id === id)
  if (!game) return <NotFound />

  const remove = () => {
    if (confirm('Diese Runde wirklich löschen?')) {
      actions.deleteGame(game.id)
      toast('Runde gelöscht.')
      navigate('/verlauf', { replace: true })
    }
  }

  const rating = FOCUS_RATINGS.find((r) => r.id === game.focusRating)?.label

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="text back" onClick={() => navigate('/verlauf')}>
          ‹ Verlauf
        </button>
        <h1>{formatDate(game.playedAt)}</h1>
        <p>
          <ResultBadge result={game.result} /> <span className="muted">{game.deck}</span>
        </p>
      </header>

      <Card>
        <dl className="details">
          {game.result === 'loss' && game.winner && <Detail label="Gewinner">{game.winner}</Detail>}
          <Detail label="Fokus">
            {SKILL_BY_ID[game.focus].name}
            {rating && <span className="muted"> · {rating}</span>}
          </Detail>
          {game.whyWinner && <Detail label="Warum hat der Gewinner gewonnen?">{game.whyWinner}</Detail>}
          {game.whyCategory && <Detail label="Woran lag es?">{WHY_LABEL[game.whyCategory]}</Detail>}
          {game.decision && (
            <Detail label="Eine Entscheidung anders">
              {game.decision}
              {game.decisionSkill && <span className="muted"> ({SKILL_BY_ID[game.decisionSkill].name})</span>}
            </Detail>
          )}
          {game.deadCards.length > 0 && <Detail label="Tote Karten">{game.deadCards.join(', ')}</Detail>}
          {game.starCards.length > 0 && <Detail label="Überperformer">{game.starCards.join(', ')}</Detail>}
          {game.ghaltaTurn !== null && <Detail label="Ghalta in Zug">{game.ghaltaTurn}</Detail>}
          {game.mulligans !== null && <Detail label="Mulligans">{game.mulligans}</Detail>}
          {game.wipe && <Detail label="Board Wipe">{WIPE_LABEL[game.wipe]}</Detail>}
          {game.feedback && <Detail label="Feedback vom Tisch">{game.feedback}</Detail>}
          {game.notes && <Detail label="Notizen">{game.notes}</Detail>}
          <Detail label="Tisch">
            {game.players} Spieler · Bracket {game.bracket}
          </Detail>
        </dl>
      </Card>

      <div className="actions">
        <button type="button" className="secondary" onClick={() => navigate(`/spiel/${game.id}/bearbeiten`)}>
          Bearbeiten
        </button>
        <button type="button" className="text danger" onClick={remove}>
          Löschen
        </button>
      </div>
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
    toast('Änderungen gespeichert.')
    history.back()
  }

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="text back" onClick={() => history.back()}>
          ‹ Abbrechen
        </button>
        <h1>Runde bearbeiten</h1>
      </header>
      <GameForm value={form} onChange={setForm} />
      <div className="sticky-actions">
        <button type="button" className="primary big" onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="page">
      <Card>
        <p>Diese Runde gibt es nicht (mehr).</p>
        <button type="button" className="secondary" onClick={() => navigate('/verlauf', { replace: true })}>
          Zum Verlauf
        </button>
      </Card>
    </div>
  )
}
