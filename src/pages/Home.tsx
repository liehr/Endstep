import { ArrowsLeftRightIcon, BookOpenIcon, CheckIcon, FlagCheckeredIcon, PlayIcon, TreasureChestIcon } from '@phosphor-icons/react'
import { useState, type CSSProperties } from 'react'
import { InstallHint } from '../components/InstallHint'
import { SKILL_ICON, SkillBadge, skillStyle } from '../components/skills'
import { TopStats } from '../components/TopStats'
import { BottomSheet, Button, Card, ProgressBar } from '../components/ui'
import { SKILLS, SKILL_BY_ID } from '../lib/content'
import { nextFocus } from '../lib/focus'
import { navigate } from '../lib/route'
import { bracketCheck, computeStats } from '../lib/stats'
import { actions, useData } from '../lib/store'
import type { Bracket, SkillId } from '../lib/types'

/** Seitlicher Versatz der Pfad-Knoten (Zickzack wie beim Duolingo-Lernpfad). */
const OFFSETS = [0, 52, 76, 52, 0, -52, -76, -52]

export function Home() {
  const { games, draft, settings, swaps, decklist } = useData()
  const [sheet, setSheet] = useState<SkillId | 'chest' | 'bracket' | null>(null)
  const current = nextFocus(games)
  const currentIndex = SKILLS.findIndex((s) => s.id === current)
  const stats = computeStats(games, settings.defaultDeck, { swaps, decklist })
  const chest = stats.upgrade
  const bracket = bracketCheck(stats.deckGames, settings.bracketCheckDone)
  const cardsLabel = `${chest.cards} Karte${chest.cards > 1 ? 'n' : ''}`

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
              {Math.min(chest.gamesSince, chest.target)}/{chest.target} Spiele · {cardsLabel}
            </small>
          </span>
        </li>
        <li
          className={`path-step chest ${bracket.due ? 'ready' : ''} ${bracket.done ? 'done' : ''}`}
          style={{ '--offset': '52px' } as CSSProperties}
        >
          <button type="button" className="path-node" aria-label={`Bracket-Check${bracket.done ? ' (erledigt)' : ''}`} onClick={() => setSheet('bracket')}>
            <FlagCheckeredIcon weight="fill" />
            {bracket.done && (
              <span className="path-check" aria-hidden="true">
                <CheckIcon weight="bold" />
              </span>
            )}
          </button>
          <span className="path-label left">
            Bracket-Check
            <small>{bracket.done ? 'erledigt' : `${Math.min(bracket.games, bracket.target)}/${bracket.target} Spiele`}</small>
          </span>
        </li>
      </ol>

      <InstallHint compact />

      <BottomSheet open={sheet !== null && sheet !== 'chest' && sheet !== 'bracket'} onClose={() => setSheet(null)}>
        {sheet && sheet !== 'chest' && sheet !== 'bracket' && <SkillSheet id={sheet} disabled={!!draft} />}
      </BottomSheet>

      <BottomSheet open={sheet === 'chest'} onClose={() => setSheet(null)} title="Upgrade-Truhe">
        <ProgressBar value={chest.gamesSince / chest.target} label="Fortschritt bis zum Upgrade" />
        {stats.upgradeReady ? (
          <>
            <p>
              <strong>{chest.gamesSince} Spiele</strong> {swaps.length ? 'seit dem letzten Swap' : `mit ${settings.defaultDeck}`}. Zeit für
              Swap-Runde {chest.round} mit höchstens {cardsLabel}. Zuerst Interaktion und Schutz gegen Wipes, nicht noch ein Dino.
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
            Spiel {chest.gamesSince} von {chest.target}
            {swaps.length ? ' seit dem letzten Swap' : ''}. Dann darfst du {cardsLabel} tauschen. Lass das Deck bis dahin
            unverändert und sammle Notizen, dann weißt du, welche Karten wirklich raus sollten.
          </p>
        )}
        <Button block variant={stats.upgradeReady ? 'primary' : 'secondary'} icon={ArrowsLeftRightIcon} onClick={() => navigate('/mehr/deck/swap')}>
          Swap-Runde eintragen
        </Button>
      </BottomSheet>

      <BottomSheet open={sheet === 'bracket'} onClose={() => setSheet(null)} title="Bracket-Check">
        <ProgressBar value={Math.min(bracket.games / bracket.target, 1)} label="Spiele bis zum Bracket-Check" />
        {bracket.done ? (
          <p>
            Erledigt. Ihr spielt Bracket {settings.defaultBracket}. Ändern kannst du das jederzeit unter Mehr → Tisch.
          </p>
        ) : bracket.due ? (
          <>
            <p>
              <strong>{bracket.games} Spiele</strong> mit {settings.defaultDeck}. Zeit, mit deiner Runde zu reden: Wollt ihr bei Bracket{' '}
              {settings.defaultBracket} bleiben oder höher spielen?
            </p>
            <p className="muted">
              Ein höheres Bracket ist keine Belohnung, sondern eine Absprache am Tisch. Ab Bracket 3 sind Game Changers erlaubt; das lohnt sich
              nur, wenn alle mitziehen.
            </p>
            {settings.defaultBracket < 5 && (
              <Button
                block
                onClick={() => {
                  actions.updateSettings({ ...settings, defaultBracket: (settings.defaultBracket + 1) as Bracket, bracketCheckDone: true })
                  setSheet(null)
                }}
              >
                Wir spielen Bracket {settings.defaultBracket + 1}
              </Button>
            )}
            <Button
              block
              variant="secondary"
              onClick={() => {
                actions.updateSettings({ ...settings, bracketCheckDone: true })
                setSheet(null)
              }}
            >
              Wir bleiben bei Bracket {settings.defaultBracket}
            </Button>
          </>
        ) : (
          <p>
            Spiel {bracket.games} von {bracket.target} mit {settings.defaultDeck}. Dann fragt die App, ob deine Runde ein höheres Bracket spielen
            will. Bis dahin: Deck kennenlernen und in kleinen Schritten verbessern.
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
