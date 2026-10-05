import { ArrowClockwiseIcon, ArrowRightIcon, ArrowsLeftRightIcon, CaretLeftIcon, CheckIcon, HeartBreakIcon, LockIcon, SealCheckIcon, TrophyIcon } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { Confetti } from '../components/Confetti'
import { RankEmblem, rankStyle } from '../components/RankEmblem'
import { SkillBadge } from '../components/skills'
import { Button, IconButton, ProgressBar } from '../components/ui'
import { EXAM_HEARTS, EXAM_QUESTIONS, RANKS, SKILL_BY_ID } from '../lib/content'
import { haptic } from '../lib/haptics'
import { rankProgress, type RankProgress } from '../lib/ranks'
import { navigate } from '../lib/route'
import { useData } from '../lib/store'

/** Home header: your rank, what it's about and how close the exam is. Tap for the ladder. */
export function RankUnit({ progress }: { progress: RankProgress }) {
  const rank = RANKS[progress.rank]
  return (
    <button type="button" className="rank-unit" style={rankStyle(progress.rank)} onClick={() => navigate('/raenge')} aria-label={`${rank.name} rank, view all ranks`}>
      <span className="rank-unit-badge">
        <RankEmblem rank={progress.rank} size={48} />
      </span>
      <span className="rank-unit-text">
        <span className="unit-eyebrow">{rank.name} rank</span>
        <h1>{rank.motto}</h1>
        {!progress.top && (
          <span className="rank-meter">
            <span className={progress.games >= progress.gamesTarget ? 'met' : ''}>
              {Math.min(progress.games, progress.gamesTarget)}/{progress.gamesTarget} games
            </span>
            <span className={progress.lessons >= progress.lessonsTarget ? 'met' : ''}>
              {Math.min(progress.lessons, progress.lessonsTarget)}/{progress.lessonsTarget} lessons
            </span>
          </span>
        )}
      </span>
    </button>
  )
}

/** What's needed for the exam, as two progress bars. */
export function RankGoals({ progress }: { progress: RankProgress }) {
  return (
    <div className="rank-goals">
      <div className="rank-goal">
        <span className="rank-goal-head">
          <span>Games in this rank</span>
          <span>
            {Math.min(progress.games, progress.gamesTarget)}/{progress.gamesTarget}
          </span>
        </span>
        <ProgressBar value={progress.games / progress.gamesTarget} label="Games in this rank" />
      </div>
      <div className="rank-goal">
        <span className="rank-goal-head">
          <span>Lessons with 4 or 5 right</span>
          <span>
            {Math.min(progress.lessons, progress.lessonsTarget)}/{progress.lessonsTarget}
          </span>
        </span>
        <ProgressBar value={progress.lessons / progress.lessonsTarget} label="Good lessons in this rank" />
      </div>
    </div>
  )
}

/** The ladder: all ranks from Bronze to Grandmaster, like Duolingo's leagues. */
export function Ranks() {
  const { promotions, games, training } = useData()
  const progress = rankProgress(promotions, games, training)
  const rank = RANKS[progress.rank]
  const next = RANKS[progress.rank + 1]
  const reachedOn = (i: number) => promotions.find((p) => p.rank === i)?.date

  return (
    <div className="screen">
      <header className="screen-header">
        <IconButton icon={CaretLeftIcon} label="Back" onClick={() => history.back()} />
      </header>

      <ol className="rank-row" aria-label="Ranks">
        {RANKS.map((r, i) => (
          <li key={r.id} className={i === progress.rank ? 'current' : ''} aria-label={`${r.name}${i === progress.rank ? ' (your rank)' : i > progress.rank ? ' (locked)' : ''}`}>
            <RankEmblem rank={i} size={40} locked={i > progress.rank} />
          </li>
        ))}
      </ol>

      <section className="rank-hero" style={rankStyle(progress.rank)}>
        <RankEmblem rank={progress.rank} size={96} />
        <span className="eyebrow">Your rank</span>
        <h1>{rank.name}</h1>
        <p className="muted">{rank.learn}</p>
      </section>

      {progress.top ? (
        <section className="panel">
          <h2>Top of the ladder</h2>
          <p>You passed every exam. Lessons now mix everything at full difficulty. Keep your streak going.</p>
        </section>
      ) : (
        <section className="panel">
          <h2>Exam for {next.name}</h2>
          <p className="muted">
            {EXAM_QUESTIONS} questions from all your lessons up to {rank.name}, with {EXAM_HEARTS} hearts. Unlocks after the games and lessons below.
          </p>
          <RankGoals progress={progress} />
          {progress.examReady ? (
            <Button block icon={TrophyIcon} onClick={() => navigate('/pruefung')}>
              Take the exam
            </Button>
          ) : (
            <Button block variant="secondary" icon={TrophyIcon} onClick={() => navigate('/pruefung')}>
              Test out early
            </Button>
          )}
        </section>
      )}

      <ol className="rank-list">
        {RANKS.map((r, i) => {
          const state = i < progress.rank ? 'done' : i === progress.rank ? 'current' : 'locked'
          const date = reachedOn(i)
          return (
            <li key={r.id} className={`rank-item ${state}`} style={rankStyle(i)}>
              <RankEmblem rank={i} size={48} locked={state === 'locked'} />
              <div>
                <span className="rank-item-head">
                  <strong>{r.name}</strong>
                  <span className="small muted">
                    {state === 'done' ? (
                      <>
                        <CheckIcon weight="bold" /> {date ?? 'done'}
                      </>
                    ) : state === 'current' ? (
                      'Your rank'
                    ) : (
                      <LockIcon weight="fill" aria-label="Locked" />
                    )}
                  </span>
                </span>
                <span className="small">{r.motto}</span>
                <span className="small muted">{r.learn}</span>
                {r.skills.length > 0 && (
                  <span className="rank-skills">
                    {r.skills.map((id) => (
                      <span key={id} className="rank-skill">
                        <SkillBadge id={id} size={24} muted={state === 'locked'} />
                        {SKILL_BY_ID[id].name}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Exam passed: the new rank with its rewards. `rank` is the new rank. */
export function Promotion({ rank }: { rank: number }) {
  useEffect(() => haptic([12, 60, 12, 60, 24]), [])
  const r = RANKS[rank]
  return (
    <div className="screen flow done promotion" style={rankStyle(rank)}>
      <Confetti />
      <div className="intro">
        <RankEmblem rank={rank} size={128} />
        <h1>You reached {r.name}!</h1>
        <p className="lead">{r.motto}</p>
      </div>
      <ul className="reward-list">
        {r.skills.map((id) => (
          <li key={id}>
            <SkillBadge id={id} size={44} />
            <div>
              <strong>New focus: {SKILL_BY_ID[id].name}</strong>
              <span className="small muted">Joins the focus rotation for your games.</span>
            </div>
          </li>
        ))}
        <li>
          <span className="reward-icon" aria-hidden="true">
            <SealCheckIcon weight="fill" />
          </span>
          <div>
            <strong>Harder questions</strong>
            <span className="small muted">{r.learn}</span>
          </div>
        </li>
        <li>
          <span className="reward-icon" aria-hidden="true">
            <ArrowsLeftRightIcon weight="bold" />
          </span>
          <div>
            <strong>Bonus card</strong>
            <span className="small muted">Your next swap round may swap one card more.</span>
          </div>
        </li>
      </ul>
      <footer className="flow-footer">
        <Button block icon={ArrowRightIcon} onClick={() => navigate('/', { replace: true })}>
          Continue
        </Button>
      </footer>
    </div>
  )
}

/** Out of hearts. */
export function ExamFailed({ rank, correct, onAgain }: { rank: number; correct: number; onAgain: () => void }) {
  useEffect(() => haptic([30, 60, 30]), [])
  return (
    <div className="screen flow done" style={rankStyle(rank)}>
      <div className="intro">
        <span className="reward-icon" aria-hidden="true" style={{ width: 96, height: 96, fontSize: 56, borderRadius: 28 }}>
          <HeartBreakIcon weight="fill" />
        </span>
        <h1>Out of hearts</h1>
        <p className="lead">
          {correct} right before the hearts ran out. Every lesson until the next try makes it easier. The exam stays open.
        </p>
      </div>
      <footer className="flow-footer stack">
        <Button block icon={ArrowRightIcon} onClick={() => navigate('/raenge', { replace: true })}>
          Continue
        </Button>
        <Button block variant="secondary" icon={ArrowClockwiseIcon} onClick={onAgain}>
          Try again
        </Button>
      </footer>
    </div>
  )
}
