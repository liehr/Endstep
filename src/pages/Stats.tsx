import { Card, ResultBadge } from '../components/ui'
import { PATTERN_THRESHOLD, SKILL_BY_ID, WHY_LABEL } from '../lib/content'
import { computeStats, type Tally } from '../lib/stats'
import { useData } from '../lib/store'

const percent = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)} %`)
const oneDecimal = (v: number | null) =>
  v === null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 1 })

function TallyList({ items, empty, highlightFrom }: { items: Tally[]; empty: string; highlightFrom?: number }) {
  if (items.length === 0) return <p className="muted">{empty}</p>
  return (
    <ul className="tally">
      {items.slice(0, 10).map((t) => (
        <li key={t.name} className={highlightFrom && t.count >= highlightFrom ? 'hot' : ''}>
          <span>{t.name}</span>
          <strong>{t.count}×</strong>
        </li>
      ))}
    </ul>
  )
}

export function Stats() {
  const { games, settings } = useData()
  const s = computeStats(games, settings.defaultDeck)

  if (s.total === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Statistik</h1>
        </header>
        <Card>
          <p>Noch keine Runden. Nach dem ersten Spiel siehst du hier deine Entwicklung.</p>
        </Card>
      </div>
    )
  }

  const maxWhy = Math.max(1, ...s.whyCounts.map((w) => w.count))

  return (
    <div className="page">
      <header className="page-header">
        <h1>Statistik</h1>
      </header>

      <div className="kpis">
        <div>
          <strong>{s.total}</strong>
          <span>Runden</span>
        </div>
        <div>
          <strong>{s.wins}</strong>
          <span>Siege</span>
        </div>
        <div>
          <strong>{percent(s.winRate)}</strong>
          <span>Siegquote</span>
        </div>
      </div>

      <Card>
        <h2>Letzte Runden</h2>
        <div className="recent">
          {s.recent.map((r, i) => (
            <ResultBadge key={i} result={r} />
          ))}
        </div>
        <p className="muted small">
          Eine einzelne schlechte Runde beweist nichts. Erst wenn dasselbe Problem zum dritten Mal
          auftaucht, ist es ein Muster.
        </p>
      </Card>

      <Card>
        <h2>Skills</h2>
        <table className="skills">
          <thead>
            <tr>
              <th>Skill</th>
              <th title="Runden mit diesem Fokus">Fokus</th>
              <th title="Ø Selbsteinschätzung (1–3)">Ø</th>
              <th title="So oft als „anders entscheiden“ notiert">Fehler</th>
            </tr>
          </thead>
          <tbody>
            {s.skills.map((k) => (
              <tr key={k.id} className={k.mistakes >= PATTERN_THRESHOLD ? 'hot' : ''}>
                <td>{SKILL_BY_ID[k.id].name}</td>
                <td>{k.games}</td>
                <td>{oneDecimal(k.avgRating)}</td>
                <td>{k.mistakes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {s.whyCounts.some((w) => w.count > 0) && (
        <Card>
          <h2>Warum verloren?</h2>
          <ul className="bars">
            {s.whyCounts.map((w) => (
              <li key={w.id}>
                <span>{WHY_LABEL[w.id]}</span>
                <div className="bar">
                  <div style={{ width: `${(w.count / maxWhy) * 100}%` }} />
                </div>
                <strong>{w.count}</strong>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2>Karten in {settings.defaultDeck}</h2>
        <h3>Tot auf der Hand</h3>
        <TallyList
          items={s.deadCards}
          empty="Noch keine toten Karten notiert."
          highlightFrom={PATTERN_THRESHOLD}
        />
        {s.upgradeCandidates.length > 0 && (
          <p className="muted small">Ab {PATTERN_THRESHOLD}× tot: Kandidat für die nächste Swap-Runde.</p>
        )}
        <h3>Überperformer</h3>
        <TallyList items={s.starCards} empty="Noch keine Überperformer notiert." />
      </Card>

      <Card>
        <h2>Spielverlauf</h2>
        <dl className="details">
          <div className="detail">
            <dt>Ø Ghalta-Zug</dt>
            <dd>{oneDecimal(s.avgGhaltaTurn)}</dd>
          </div>
          <div className="detail">
            <dt>Ø Mulligans</dt>
            <dd>{oneDecimal(s.avgMulligans)}</dd>
          </div>
          <div className="detail">
            <dt>Wipes mit Nachschub auf der Hand</dt>
            <dd>{s.wipes.kept}</dd>
          </div>
          <div className="detail">
            <dt>Wipes, bei denen alles weg war</dt>
            <dd>{s.wipes.overextended}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
