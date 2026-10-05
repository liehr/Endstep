import { ArrowsLeftRightIcon, BookOpenIcon, CheckIcon, FlagCheckeredIcon, PlayIcon, TreasureChestIcon } from '@phosphor-icons/react'
import { useState, type CSSProperties } from 'react'
import { DailyGoal } from '../components/DailyGoal'
import { InstallHint } from '../components/InstallHint'
import { SKILL_ICON, SkillBadge, skillStyle } from '../components/skills'
import { TopStats } from '../components/TopStats'
import { BottomSheet, Button, Card, ProgressBar } from '../components/ui'
import { SKILLS, SKILL_BY_ID } from '../lib/content'
import { nextFocus } from '../lib/focus'
import { navigate } from '../lib/route'
import { swapsOf } from '../lib/data'
import { bracketCheck, computeStats } from '../lib/stats'
import { actions, useData } from '../lib/store'
import type { Bracket, SkillId } from '../lib/types'

/** Sideways offset of the path nodes (zigzag like the Duolingo learning path). */
const OFFSETS = [0, 52, 76, 52, 0, -52, -76, -52]

export function Home() {
  const { games, draft, settings, swaps: allSwaps, decklist } = useData()
  const swaps = swapsOf(allSwaps, settings.defaultDeck)
  const [sheet, setSheet] = useState<SkillId | 'chest' | 'bracket' | null>(null)
  const current = nextFocus(games)
  const currentIndex = SKILLS.findIndex((s) => s.id === current)
  const stats = computeStats(games, settings.defaultDeck, { swaps, decklist })
  const chest = stats.upgrade
  const bracket = bracketCheck(stats.deckGames, settings.bracketCheckDone)
  const cardsLabel = `${chest.cards} card${chest.cards === 1 ? '' : 's'}`

  return (
    <div className="screen">
      <TopStats />

      <DailyGoal />

      {draft && (
        <Card className="draft-banner" style={skillStyle(draft.form.focus)}>
          <SkillBadge id={draft.form.focus} size={44} />
          <div>
            <strong>Game in progress</strong>
            <span className="muted">Focus: {SKILL_BY_ID[draft.form.focus].name}</span>
          </div>
          <Button size="sm" onClick={() => navigate('/runde')}>
            Continue
          </Button>
        </Card>
      )}

      <section className="unit" aria-label="Focus rotation">
        <div>
          <span className="unit-eyebrow">Focus rotation</span>
          <h1>One skill per game</h1>
        </div>
        <button type="button" className="unit-btn" aria-label="View all skills" onClick={() => navigate('/mehr/spickzettel')}>
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
                aria-label={`${skill.name}${state === 'done' ? ' (done)' : state === 'current' ? ' (up next)' : ''}`}
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
          <button type="button" className="path-node" aria-label="Upgrade chest" onClick={() => setSheet('chest')}>
            <TreasureChestIcon weight="fill" />
          </button>
          <span className="path-label right">
            Upgrade chest
            <small>
              {Math.min(chest.gamesSince, chest.target)}/{chest.target} games · {cardsLabel}
            </small>
          </span>
        </li>
        <li
          className={`path-step chest ${bracket.due ? 'ready' : ''} ${bracket.done ? 'done' : ''}`}
          style={{ '--offset': '52px' } as CSSProperties}
        >
          <button type="button" className="path-node" aria-label={`Bracket check${bracket.done ? ' (done)' : ''}`} onClick={() => setSheet('bracket')}>
            <FlagCheckeredIcon weight="fill" />
            {bracket.done && (
              <span className="path-check" aria-hidden="true">
                <CheckIcon weight="bold" />
              </span>
            )}
          </button>
          <span className="path-label left">
            Bracket check
            <small>{bracket.done ? 'done' : `${Math.min(bracket.games, bracket.target)}/${bracket.target} games`}</small>
          </span>
        </li>
      </ol>

      <InstallHint compact />

      <BottomSheet open={sheet !== null && sheet !== 'chest' && sheet !== 'bracket'} onClose={() => setSheet(null)}>
        {sheet && sheet !== 'chest' && sheet !== 'bracket' && <SkillSheet id={sheet} disabled={!!draft} />}
      </BottomSheet>

      <BottomSheet open={sheet === 'chest'} onClose={() => setSheet(null)} title="Upgrade chest">
        <ProgressBar value={chest.gamesSince / chest.target} label="Progress to the upgrade" />
        {stats.upgradeReady ? (
          <>
            <p>
              <strong>{chest.gamesSince} games</strong> {swaps.length ? 'since the last swap' : `with ${settings.defaultDeck}`}. Time for
              swap round {chest.round} with at most {cardsLabel}. Interaction and protection against wipes first, not another dino.
            </p>
            {stats.upgradeCandidates.length > 0 ? (
              <p>
                Candidates (dead 3× or more): <strong>{stats.upgradeCandidates.map((c) => c.name).join(', ')}</strong>
              </p>
            ) : (
              <p className="muted">No card has been dead 3× yet. Note dead cards after every game.</p>
            )}
          </>
        ) : (
          <p>
            Game {chest.gamesSince} of {chest.target}
            {swaps.length ? ' since the last swap' : ''}. Then you can swap {cardsLabel}. Leave the deck unchanged until
            then and collect notes, so you’ll know which cards really should go out.
          </p>
        )}
        <Button block variant={stats.upgradeReady ? 'primary' : 'secondary'} icon={ArrowsLeftRightIcon} onClick={() => navigate('/mehr/deck/swap')}>
          Log swap round
        </Button>
      </BottomSheet>

      <BottomSheet open={sheet === 'bracket'} onClose={() => setSheet(null)} title="Bracket check">
        <ProgressBar value={Math.min(bracket.games / bracket.target, 1)} label="Games until the Bracket check" />
        {bracket.done ? (
          <p>
            Done. Your group plays Bracket {settings.defaultBracket}. You can change this any time under More → Table.
          </p>
        ) : bracket.due ? (
          <>
            <p>
              <strong>{bracket.games} games</strong> with {settings.defaultDeck}. Time to talk with your group: do you want to stay at Bracket{' '}
              {settings.defaultBracket} or play higher?
            </p>
            <p className="muted">
              A higher bracket isn’t a reward, it’s an agreement at the table. From Bracket 3, Game Changers are allowed; that’s only worth it
              if everyone is on board.
            </p>
            {settings.defaultBracket < 5 && (
              <Button
                block
                onClick={() => {
                  actions.updateSettings({ ...settings, defaultBracket: (settings.defaultBracket + 1) as Bracket, bracketCheckDone: true })
                  setSheet(null)
                }}
              >
                We play Bracket {settings.defaultBracket + 1}
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
              We stay at Bracket {settings.defaultBracket}
            </Button>
          </>
        ) : (
          <p>
            Game {bracket.games} of {bracket.target} with {settings.defaultDeck}. Then the app asks whether your group wants to play a higher
            bracket. Until then: get to know the deck and improve it in small steps.
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
        <strong>Task:</strong> {skill.task}
      </p>
      <Button block icon={PlayIcon} disabled={disabled} onClick={() => navigate(`/runde/neu/${id}`)}>
        Play with this focus
      </Button>
      {disabled && <p className="muted small center">Finish the game in progress first.</p>}
    </div>
  )
}
