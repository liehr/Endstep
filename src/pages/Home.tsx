import { ArrowsLeftRightIcon, CheckIcon, FlagCheckeredIcon, LockIcon, PlayIcon, TreasureChestIcon } from '@phosphor-icons/react'
import { useState, type CSSProperties } from 'react'
import { DailyGoal } from '../components/DailyGoal'
import { InstallHint } from '../components/InstallHint'
import { SKILL_ICON, SkillBadge, skillStyle } from '../components/skills'
import { TopStats } from '../components/TopStats'
import { BottomSheet, Button, Card, ProgressBar } from '../components/ui'
import { RankEmblem } from '../components/RankEmblem'
import { RANKS, SKILL_BY_ID } from '../lib/content'
import { nextFocus } from '../lib/focus'
import { rankProgress, SKILL_PATH, skillRank, unlockedSkills } from '../lib/ranks'
import { RankUnit } from './Ranks'
import { navigate } from '../lib/route'
import { swapsOf } from '../lib/data'
import { bracketCheck, computeStats } from '../lib/stats'
import { actions, useData } from '../lib/store'
import type { Bracket, SkillId } from '../lib/types'

/** Sideways offset of the path nodes (zigzag like the Duolingo learning path). */
const OFFSETS = [0, 52, 76, 52, 0, -52, -76, -52]

export function Home() {
  const { games, draft, settings, swaps: allSwaps, decklist, promotions, training } = useData()
  const swaps = swapsOf(allSwaps, settings.defaultDeck)
  const [sheet, setSheet] = useState<SkillId | 'chest' | 'bracket' | null>(null)
  const progress = rankProgress(promotions, games, training)
  const unlocked = unlockedSkills(progress.rank)
  const current = nextFocus(games, unlocked)
  const currentIndex = unlocked.indexOf(current)
  // Your skills, plus a preview of what the next rank unlocks.
  const pathSkills = SKILL_PATH.filter((id) => skillRank(id) <= progress.rank + 1)
  const stats = computeStats(games, settings.defaultDeck, {
    swaps,
    decklist,
    promotions,
    upgradeEvery: settings.upgradeEvery,
    patternThreshold: settings.patternThreshold,
  })
  const chest = stats.upgrade
  const bracket = bracketCheck(stats.deckGames, settings.bracketCheckDone, settings.bracketCheckGames)
  const cardsLabel = `${chest.cards} card${chest.cards === 1 ? '' : 's'}`
  const bonusNote = chest.bonus ? ' (one is your rank bonus)' : ''

  return (
    <div className="screen">
      <TopStats />

      {settings.showDailyGoal && <DailyGoal />}

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

      <RankUnit progress={progress} />

      <ol className="path">
        {pathSkills.map((id, i) => {
          const skill = SKILL_BY_ID[id]
          const open = unlocked.indexOf(id)
          const state = open < 0 ? 'skill-locked' : open < currentIndex ? 'done' : open === currentIndex ? 'current' : 'idle'
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
                aria-label={`${skill.name}${state === 'done' ? ' (done)' : state === 'current' ? ' (up next)' : state === 'skill-locked' ? ' (locked)' : ''}`}
                onClick={() => (state === 'current' && !draft ? navigate(`/runde/neu/${skill.id}`) : setSheet(skill.id))}
              >
                {state === 'skill-locked' ? <LockIcon weight="fill" /> : <IconCmp weight="fill" />}
                {state === 'done' && (
                  <span className="path-check" aria-hidden="true">
                    <CheckIcon weight="bold" />
                  </span>
                )}
              </button>
              <span className={`path-label ${offset > 0 ? 'left' : 'right'}`}>
                {skill.name}
                {state === 'skill-locked' && <small>Unlocks in {RANKS[skillRank(id)].name}</small>}
              </span>
            </li>
          )
        })}
        {!progress.top && (
          <li className={`path-step exam ${progress.examReady ? 'ready' : ''}`} style={{ '--offset': `${OFFSETS[pathSkills.length % OFFSETS.length]}px` } as CSSProperties}>
            <button
              type="button"
              className="path-node"
              aria-label={`Exam for ${RANKS[progress.rank + 1].name}${progress.examReady ? ' (ready)' : ''}`}
              onClick={() => navigate(progress.examReady ? '/pruefung' : '/raenge')}
            >
              <RankEmblem rank={progress.rank + 1} size={68} locked={!progress.examReady} />
            </button>
            <span className={`path-label ${OFFSETS[pathSkills.length % OFFSETS.length] > 0 ? 'left' : 'right'}`}>
              Exam for {RANKS[progress.rank + 1].name}
              <small>{progress.examReady ? 'Ready!' : `${Math.min(progress.games, progress.gamesTarget)}/${progress.gamesTarget} games · ${Math.min(progress.lessons, progress.lessonsTarget)}/${progress.lessonsTarget} lessons`}</small>
            </span>
          </li>
        )}
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
        {bracket.target > 0 && (
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
        )}
      </ol>

      <InstallHint compact />

      <BottomSheet open={sheet !== null && sheet !== 'chest' && sheet !== 'bracket'} onClose={() => setSheet(null)}>
        {sheet && sheet !== 'chest' && sheet !== 'bracket' && (
          <SkillSheet id={sheet} disabled={!!draft} lockedUntil={unlocked.includes(sheet) ? null : skillRank(sheet)} />
        )}
      </BottomSheet>

      <BottomSheet open={sheet === 'chest'} onClose={() => setSheet(null)} title="Upgrade chest">
        <ProgressBar value={chest.gamesSince / chest.target} label="Progress to the upgrade" />
        {stats.upgradeReady ? (
          <>
            <p>
              <strong>{chest.gamesSince} games</strong> {swaps.length ? 'since the last swap' : `with ${settings.defaultDeck}`}. Time for
              swap round {chest.round} with at most {cardsLabel}{bonusNote}. Interaction and protection against wipes first, not another dino.
            </p>
            {stats.upgradeCandidates.length > 0 ? (
              <p>
                Candidates (dead {settings.patternThreshold}× or more): <strong>{stats.upgradeCandidates.map((c) => c.name).join(', ')}</strong>
              </p>
            ) : (
              <p className="muted">No card has been dead {settings.patternThreshold}× yet. Note dead cards after every game.</p>
            )}
          </>
        ) : (
          <p>
            Game {chest.gamesSince} of {chest.target}
            {swaps.length ? ' since the last swap' : ''}. Then you can swap {cardsLabel}{bonusNote}. Leave the deck unchanged until
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

function SkillSheet({ id, disabled, lockedUntil }: { id: SkillId; disabled: boolean; lockedUntil: number | null }) {
  const skill = SKILL_BY_ID[id]
  return (
    <div className="skill-sheet" style={skillStyle(id)}>
      <SkillBadge id={id} size={72} />
      <h2>{skill.name}</h2>
      <p>{skill.tip}</p>
      <p className="muted">
        <strong>Task:</strong> {skill.task}
      </p>
      {lockedUntil !== null ? (
        <p className="muted small center">Unlocks in {RANKS[lockedUntil].name}. Master the skills before it first.</p>
      ) : (
        <>
          <Button block icon={PlayIcon} disabled={disabled} onClick={() => navigate(`/runde/neu/${id}`)}>
            Play with this focus
          </Button>
          {disabled && <p className="muted small center">Finish the game in progress first.</p>}
        </>
      )}
    </div>
  )
}
