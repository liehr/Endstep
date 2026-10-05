import { InstallHint } from '../components/InstallHint'
import { Card, ResultBadge } from '../components/ui'
import { SKILL_BY_ID, UPGRADE_AFTER_GAMES } from '../lib/content'
import { formatDate } from '../lib/dates'
import { nextFocus, sortGames } from '../lib/focus'
import { navigate } from '../lib/route'
import { computeStats } from '../lib/stats'
import { actions, useData } from '../lib/store'

export function Home() {
  const { games, draft, settings } = useData()
  const focus = SKILL_BY_ID[nextFocus(games)]
  const stats = computeStats(games, settings.defaultDeck)
  const last = sortGames(games)[0]

  const start = () => {
    actions.startDraft()
    navigate('/runde')
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Endstep</h1>
        <p className="muted">Jede Runde ein Training.</p>
      </header>

      {draft ? (
        <Card className="highlight">
          <h2>Laufende Runde</h2>
          <p>
            Fokus: <strong>{SKILL_BY_ID[draft.form.focus].name}</strong>
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={() => navigate('/runde')}>
              Weiter spielen
            </button>
            <button type="button" className="secondary" onClick={() => navigate('/runde/ende')}>
              Spiel beendet
            </button>
          </div>
        </Card>
      ) : (
        <Card className="highlight">
          <span className="eyebrow">Nächster Fokus</span>
          <h2>{focus.name}</h2>
          <p>{focus.task}</p>
          <button type="button" className="primary big" onClick={start}>
            Neue Runde starten
          </button>
        </Card>
      )}

      {stats.patterns.length > 0 && (
        <Card className="warning">
          <h2>Muster erkannt</h2>
          {stats.patterns.map((p) => (
            <p key={p.id}>
              <strong>{SKILL_BY_ID[p.id].name}</strong> taucht schon {p.mistakes}× bei „anders
              entscheiden“ auf. Nimm ihn dir gezielt als Fokus vor.
            </p>
          ))}
        </Card>
      )}

      <Card>
        <h2>Upgrade-Fahrplan</h2>
        <div className="progress" aria-label={`${stats.deckGames} von ${UPGRADE_AFTER_GAMES} Spielen`}>
          <div style={{ width: `${Math.min(100, (stats.deckGames / UPGRADE_AFTER_GAMES) * 100)}%` }} />
        </div>
        {stats.upgradeReady ? (
          <p>
            {stats.deckGames} Spiele mit {settings.defaultDeck}. Zeit für eine Swap-Runde mit 3–5
            Karten, zuerst Interaktion und Schutz gegen Wipes.
            {stats.upgradeCandidates.length > 0 &&
              ` Kandidaten: ${stats.upgradeCandidates.map((c) => c.name).join(', ')}.`}
          </p>
        ) : (
          <p>
            Spiel {stats.deckGames} von {UPGRADE_AFTER_GAMES}: Deck noch unverändert lassen und
            Notizen sammeln.
          </p>
        )}
      </Card>

      {last && (
        <Card>
          <h2>Letzte Runde</h2>
          <button type="button" className="list-item" onClick={() => navigate(`/spiel/${last.id}`)}>
            <span>
              <strong>{formatDate(last.playedAt)}</strong>
              <span className="muted small">Fokus: {SKILL_BY_ID[last.focus].name}</span>
            </span>
            <ResultBadge result={last.result} />
          </button>
          {last.decision && (
            <p className="quote">„{last.decision}“</p>
          )}
        </Card>
      )}

      <button type="button" className="secondary block" onClick={() => navigate('/ghalta')}>
        Ghalta-Rechner öffnen
      </button>

      <InstallHint />
    </div>
  )
}
