import { CheckIcon, WarningIcon, XIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { SkillBadge } from '../components/skills'
import { EmptyState } from '../components/ui'
import { PATTERN_THRESHOLD, SKILL_BY_ID, WHY_LABEL } from '../lib/content'
import { today } from '../lib/dates'
import { computeStats, type Tally } from '../lib/stats'
import { weekStreak } from '../lib/streak'
import { useData } from '../lib/store'

const percent = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)} %`)
const oneDecimal = (v: number | null) => (v === null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 1 }))

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

/** Horizontaler Balken mit Beschriftung und Wert: eine Reihe, eine Farbe. */
function BarRow({ label, value, max, lead }: { label: string; value: number; max: number; lead?: ReactNode }) {
  return (
    <li className="bar-row">
      {lead}
      <div className="bar-main">
        <div className="bar-head">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
        <div className="bar-track">
          {value > 0 && <div className="bar-fill" style={{ width: `${(value / max) * 100}%` }} />}
        </div>
      </div>
    </li>
  )
}

function TallyList({ items, empty }: { items: Tally[]; empty: string }) {
  if (items.length === 0) return <p className="muted small">{empty}</p>
  return (
    <ul className="tally">
      {items.slice(0, 8).map((t) => (
        <li key={t.name}>
          <span>{t.name}</span>
          <span className="tally-count">
            {t.count >= PATTERN_THRESHOLD && <WarningIcon weight="fill" aria-label="3× oder öfter" />}
            {t.count}×
          </span>
        </li>
      ))}
    </ul>
  )
}

export function Stats() {
  const { games, settings } = useData()
  const s = computeStats(games, settings.defaultDeck)
  const streak = weekStreak(games, today())

  if (s.total === 0) {
    return (
      <div className="screen">
        <header className="screen-header">
          <h1>Statistik</h1>
        </header>
        <EmptyState title="Noch nichts zu zählen" text="Nach deiner ersten Runde siehst du hier, wo du besser wirst." />
      </div>
    )
  }

  const maxMistakes = Math.max(...s.skills.map((k) => k.mistakes))
  const maxWhy = Math.max(...s.whyCounts.map((w) => w.count))
  const recent = [...games].sort((a, b) => b.playedAt.localeCompare(a.playedAt) || b.createdAt.localeCompare(a.createdAt)).slice(0, 10)

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Statistik</h1>
      </header>

      <div className="stat-grid">
        <StatTile label="Runden" value={s.total} />
        <StatTile label="Siegquote" value={percent(s.winRate)} sub={`${s.wins} ${s.wins === 1 ? 'Sieg' : 'Siege'}`} />
        <StatTile label="Serie" value={`${streak.current} Wo.`} sub={`Rekord: ${streak.best}`} />
        <StatTile
          label="Ø Ghalta-Zug"
          value={oneDecimal(s.avgGhaltaTurn)}
          sub={s.avgMulligans === null ? undefined : `Ø ${oneDecimal(s.avgMulligans)} Mulligans`}
        />
      </div>

      <section className="panel">
        <h2>Letzte Runden</h2>
        <ol className="recent" aria-label="Letzte Runden, neueste zuerst">
          {recent.map((g) => (
            <li key={g.id} className={`recent-dot ${g.result}`} title={g.result === 'win' ? 'Sieg' : 'Niederlage'}>
              {g.result === 'win' ? <CheckIcon weight="bold" aria-label="Sieg" /> : <XIcon weight="bold" aria-label="Niederlage" />}
            </li>
          ))}
        </ol>
        <p className="muted small">Eine einzelne Runde beweist nichts. Erst ab 3× ist es ein Muster.</p>
      </section>

      <section className="panel">
        <h2>Woran du arbeiten kannst</h2>
        <p className="muted small">So oft wurde ein Skill als „eine Entscheidung anders“ notiert.</p>
        {maxMistakes === 0 ? (
          <p className="muted small">Noch keine Entscheidungen einem Skill zugeordnet.</p>
        ) : (
          <ul className="bars">
            {[...s.skills]
              .sort((a, b) => b.mistakes - a.mistakes)
              .filter((k) => k.mistakes > 0)
              .map((k) => (
                <BarRow
                  key={k.id}
                  label={`${SKILL_BY_ID[k.id].name}${k.mistakes >= PATTERN_THRESHOLD ? ' · Muster' : ''}`}
                  value={k.mistakes}
                  max={maxMistakes}
                  lead={<SkillBadge id={k.id} size={36} />}
                />
              ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Fokus geübt</h2>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Runden</th>
              <th scope="col" title="Selbsteinschätzung 1–3">
                Ø Gefühl
              </th>
            </tr>
          </thead>
          <tbody>
            {s.skills.map((k) => (
              <tr key={k.id}>
                <td>
                  <span className="table-skill">
                    <SkillBadge id={k.id} size={28} muted={k.games === 0} />
                    {SKILL_BY_ID[k.id].name}
                  </span>
                </td>
                <td>{k.games}</td>
                <td>{k.avgRating === null ? '–' : `${oneDecimal(k.avgRating)} / 3`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {maxWhy > 0 && (
        <section className="panel">
          <h2>Warum verloren?</h2>
          <ul className="bars">
            {s.whyCounts.map((w) => (
              <BarRow key={w.id} label={WHY_LABEL[w.id]} value={w.count} max={maxWhy} />
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>Karten</h2>
        <p className="muted small">{settings.defaultDeck}</p>
        <h3>Tot auf der Hand</h3>
        <TallyList items={s.deadCards} empty="Noch keine toten Karten notiert." />
        <h3>Überperformer</h3>
        <TallyList items={s.starCards} empty="Noch keine Überperformer notiert." />
      </section>

      <section className="panel">
        <h2>Board Wipes</h2>
        <div className="stat-grid">
          <StatTile label="Nachschub behalten" value={s.wipes.kept} />
          <StatTile label="Alles verloren" value={s.wipes.overextended} />
        </div>
      </section>
    </div>
  )
}
