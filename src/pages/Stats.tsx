import { CheckIcon, WarningIcon, XIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { SkillBadge } from '../components/skills'
import { EmptyState } from '../components/ui'
import { PATTERN_THRESHOLD, SKILL_BY_ID, WHY_LABEL } from '../lib/content'
import { today } from '../lib/dates'
import { computeStats, type Tally } from '../lib/stats'
import { weekStreak } from '../lib/streak'
import { useData } from '../lib/store'

const percent = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`)
const oneDecimal = (v: number | null) => (v === null ? '–' : v.toLocaleString('en-GB', { maximumFractionDigits: 1 }))

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

/** Horizontal bar with label and value: one row, one colour. */
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
            {t.count >= PATTERN_THRESHOLD && <WarningIcon weight="fill" aria-label="3× or more" />}
            {t.count}×
          </span>
        </li>
      ))}
    </ul>
  )
}

export function Stats() {
  const { games, settings, swaps, decklist } = useData()
  const s = computeStats(games, settings.defaultDeck, { swaps, decklist })
  const streak = weekStreak(games, today())

  if (s.total === 0) {
    return (
      <div className="screen">
        <header className="screen-header">
          <h1>Stats</h1>
        </header>
        <EmptyState title="Nothing to count yet" text="After your first game you'll see here where you're improving." />
      </div>
    )
  }

  const maxMistakes = Math.max(...s.skills.map((k) => k.mistakes))
  const maxWhy = Math.max(...s.whyCounts.map((w) => w.count))
  const recent = [...games].sort((a, b) => b.playedAt.localeCompare(a.playedAt) || b.createdAt.localeCompare(a.createdAt)).slice(0, 10)

  return (
    <div className="screen wide">
      <header className="screen-header">
        <h1>Stats</h1>
      </header>

      <div className="stat-grid">
        <StatTile label="Games" value={s.total} />
        <StatTile label="Win rate" value={percent(s.winRate)} sub={`${s.wins} ${s.wins === 1 ? 'win' : 'wins'}`} />
        <StatTile label="Streak" value={`${streak.current} ${streak.current === 1 ? 'wk' : 'wks'}`} sub={`Best: ${streak.best}`} />
        <StatTile
          label="Avg. commander turn"
          value={oneDecimal(s.avgCommanderTurn)}
          sub={s.avgMulligans === null ? undefined : `Avg. ${oneDecimal(s.avgMulligans)} mulligans`}
        />
        {s.avgTurns !== null && <StatTile label="Avg. turns per game" value={oneDecimal(s.avgTurns)} />}
      </div>

      <div className="panel-columns">
        <section className="panel">
          <h2>Recent games</h2>
          <ol className="recent" aria-label="Recent games, newest first">
            {recent.map((g) => (
              <li key={g.id} className={`recent-dot ${g.result}`} title={g.result === 'win' ? 'Win' : 'Loss'}>
                {g.result === 'win' ? <CheckIcon weight="bold" aria-label="Win" /> : <XIcon weight="bold" aria-label="Loss" />}
              </li>
            ))}
          </ol>
          <p className="muted small">A single game proves nothing. Only from 3× on is it a pattern.</p>
        </section>

        <section className="panel">
          <h2>What you can work on</h2>
          <p className="muted small">How often a skill was noted as "one decision I'd make differently".</p>
          {maxMistakes === 0 ? (
            <p className="muted small">No decisions assigned to a skill yet.</p>
          ) : (
            <ul className="bars">
              {[...s.skills]
                .sort((a, b) => b.mistakes - a.mistakes)
                .filter((k) => k.mistakes > 0)
                .map((k) => (
                  <BarRow
                    key={k.id}
                    label={`${SKILL_BY_ID[k.id].name}${k.mistakes >= PATTERN_THRESHOLD ? ' · Pattern' : ''}`}
                    value={k.mistakes}
                    max={maxMistakes}
                    lead={<SkillBadge id={k.id} size={36} />}
                  />
                ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Focus practised</h2>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Games</th>
                <th scope="col" title="Self-assessment 1–3">
                  Avg. feel
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
            <h2>Why did you lose?</h2>
            <ul className="bars">
              {s.whyCounts.map((w) => (
                <BarRow key={w.id} label={WHY_LABEL[w.id]} value={w.count} max={maxWhy} />
              ))}
            </ul>
          </section>
        )}

        <section className="panel">
          <h2>Cards</h2>
          <p className="muted small">{settings.defaultDeck}</p>
          <h3>Dead in hand</h3>
          <TallyList items={s.deadCards} empty="No dead cards noted yet." />
          <h3>Overperformers</h3>
          <TallyList items={s.starCards} empty="No overperformers noted yet." />
        </section>

        {s.upgrade.phases.length > 1 && (
          <section className="panel">
            <h2>Deck versions</h2>
            <p className="muted small">Win rate before and after your swap rounds.</p>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Games</th>
                  <th scope="col">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {s.upgrade.phases.map((p) => (
                  <tr key={p.label}>
                    <td>{p.label}</td>
                    <td>{p.games}</td>
                    <td>{p.games ? percent(p.wins / p.games) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">A few games are no proof yet: the comparison is only worth it after about 8 games per version.</p>
          </section>
        )}

        <section className="panel">
          <h2>Board Wipes</h2>
          <div className="stat-grid">
            <StatTile label="Kept reloads" value={s.wipes.kept} />
            <StatTile label="Lost everything" value={s.wipes.overextended} />
          </div>
        </section>
      </div>
    </div>
  )
}
