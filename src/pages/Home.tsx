import { BookOpenIcon, CheckIcon, PlayIcon, TreasureChestIcon } from '@phosphor-icons/react'
import { useState, type CSSProperties } from 'react'
import { InstallHint } from '../components/InstallHint'
import { SKILL_ICON, SkillBadge, skillStyle } from '../components/skills'
import { TopStats } from '../components/TopStats'
import { BottomSheet, Button, Card, ProgressBar } from '../components/ui'
import { SKILLS, SKILL_BY_ID, UPGRADE_AFTER_GAMES } from '../lib/content'
import { nextFocus } from '../lib/focus'
import { navigate } from '../lib/route'
import { computeStats } from '../lib/stats'
import { useData } from '../lib/store'
import type { SkillId } from '../lib/types'

/** Seitlicher Versatz der Pfad-Knoten (Zickzack wie beim Duolingo-Lernpfad). */
const OFFSETS = [0, 52, 76, 52, 0, -52, -76, -52]

export function Home() {
  const { games, draft, settings } = useData()
  const [sheet, setSheet] = useState<SkillId | 'chest' | null>(null)
  const current = nextFocus(games)
  const currentIndex = SKILLS.findIndex((s) => s.id === current)
  const stats = computeStats(games, settings.defaultDeck)

  return (
    <div className="screen">
      <TopStats />

      {draft && (
        <Card className="draft-banner" style={skillStyle(draft.form.focus)}>
          <SkillBadge id={draft.form.focus} size={44} />
          <div>
            <strong>Runde läuft</strong>
            <span className="muted">Fokus: {SKILL_BY_ID[draft.form.focus].name}</span>
          </div>
          <Button size="sm" onClick={() => navigate('/runde')}>
            Weiter
          </Button>
        </Card>
      )}

      <section className="unit" aria-label="Fokus-Rotation">
        <div>
          <span className="unit-eyebrow">Fokus-Rotation</span>
          <h1>Ein Skill pro Runde</h1>
        </div>
        <button type="button" className="unit-btn" aria-label="Alle Skills ansehen" onClick={() => navigate('/mehr/spickzettel')}>
          <BookOpenIcon weight="fill" />
        </button>
      </section>

      <ol className="path">
        {SKILLS.map((skill, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'idle'
          const IconCmp = SKILL_ICON[skill.id]
          const offset = OFFSETS[i % OFFSETS.length]
          return (
            <li
              key={skill.id}
              className={`path-step ${state}`}
              style={{ ...skillStyle(skill.id), '--offset': `${offset}px` } as CSSProperties}
            >
              {state === 'current' && !draft && <span className="path-bubble">Start</span>}
              <button
                type="button"
                className="path-node"
                aria-label={`${skill.name}${state === 'done' ? ' (erledigt)' : state === 'current' ? ' (als Nächstes)' : ''}`}
                onClick={() => (state === 'current' && !draft ? navigate(`/runde/neu/${skill.id}`) : setSheet(skill.id))}
              >
                <IconCmp weight="fill" />
                {state === 'done' && (
                  <span className="path-check" aria-hidden="true">
                    <CheckIcon weight="bold" />
                  </span>
                )}
              </button>
              <span className={`path-label ${offset > 0 ? 'left' : 'right'}`}>{skill.name}</span>
            </li>
          )
        })}
        <li className={`path-step chest ${stats.upgradeReady ? 'ready' : ''}`} style={{ '--offset': '0px' } as CSSProperties}>
          <button type="button" className="path-node" aria-label="Upgrade-Truhe" onClick={() => setSheet('chest')}>
            <TreasureChestIcon weight="fill" />
          </button>
          <span className="path-label right">
            Upgrade-Truhe
            <small>
              {Math.min(stats.deckGames, UPGRADE_AFTER_GAMES)}/{UPGRADE_AFTER_GAMES} Spiele
            </small>
          </span>
        </li>
      </ol>

      <InstallHint compact />

      <BottomSheet open={sheet !== null && sheet !== 'chest'} onClose={() => setSheet(null)}>
        {sheet && sheet !== 'chest' && <SkillSheet id={sheet} disabled={!!draft} />}
      </BottomSheet>

      <BottomSheet open={sheet === 'chest'} onClose={() => setSheet(null)} title="Upgrade-Truhe">
        <ProgressBar value={stats.deckGames / UPGRADE_AFTER_GAMES} label="Fortschritt bis zum Upgrade" />
        {stats.upgradeReady ? (
          <>
            <p>
              <strong>{stats.deckGames} Spiele</strong> mit {settings.defaultDeck}. Zeit für eine
              Swap-Runde mit 3–5 Karten. Zuerst Interaktion und Schutz gegen Wipes, nicht noch ein Dino.
            </p>
            {stats.upgradeCandidates.length > 0 ? (
              <p>
                Kandidaten (mind. 3× tot): <strong>{stats.upgradeCandidates.map((c) => c.name).join(', ')}</strong>
              </p>
            ) : (
              <p className="muted">Noch keine Karte war 3× tot. Notiere tote Karten nach jeder Runde.</p>
            )}
          </>
        ) : (
          <p>
            Spiel {stats.deckGames} von {UPGRADE_AFTER_GAMES}. Lass das Deck bis dahin unverändert und
            sammle Notizen. Dann weißt du, welche Karten wirklich raus sollten.
          </p>
        )}
      </BottomSheet>
    </div>
  )
}

function SkillSheet({ id, disabled }: { id: SkillId; disabled: boolean }) {
  const skill = SKILL_BY_ID[id]
  return (
    <div className="skill-sheet" style={skillStyle(id)}>
      <SkillBadge id={id} size={72} />
      <h2>{skill.name}</h2>
      <p>{skill.tip}</p>
      <p className="muted">
        <strong>Aufgabe:</strong> {skill.task}
      </p>
      <Button block icon={PlayIcon} disabled={disabled} onClick={() => navigate(`/runde/neu/${id}`)}>
        Mit diesem Fokus spielen
      </Button>
      {disabled && <p className="muted small center">Beende zuerst die laufende Runde.</p>}
    </div>
  )
}
