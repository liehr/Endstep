import { ArrowClockwiseIcon, ArrowRightIcon, PlayIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { AnswerLabel } from '../components/CardFrame'
import { Confetti } from '../components/Confetti'
import { Button, IconButton, ProgressBar } from '../components/ui'
import { haptic } from '../lib/haptics'
import { CHALLENGE_SECONDS, challengeBest, challengeQuestion, WRONG_PENALTY_SECONDS, type ChallengeQuestion } from '../lib/quiz/challenge'
import { navigate } from '../lib/route'
import { mulberry32, randomSeed } from '../lib/sim/rng'
import { actions, useData } from '../lib/store'
import { useDeckCards } from '../lib/useDeckCards'
import { LESSON_ICON, lessonStyle } from './Training'

type Phase = 'intro' | 'running' | 'done'

/** Ghalta Rush: as many Ghalta Math questions as you can in 60 seconds. */
export function Challenge() {
  const deck = useDeckCards({ autoLoad: false })
  const { training } = useData()
  const [phase, setPhase] = useState<Phase>('intro')
  const [bestBefore, setBestBefore] = useState(() => challengeBest(training))
  const [question, setQuestion] = useState<ChallengeQuestion | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [left, setLeft] = useState(CHALLENGE_SECONDS * 1000)
  const rng = useRef(mulberry32(randomSeed()))
  const deadline = useRef(0)
  const advance = useRef<ReturnType<typeof setTimeout>>(undefined)

  const nextQuestion = () => {
    setPicked(null)
    setQuestion(challengeQuestion(deck, rng.current))
  }

  const start = () => {
    rng.current = mulberry32(randomSeed())
    setBestBefore(challengeBest(training))
    setScore(0)
    setAnswered(0)
    deadline.current = Date.now() + CHALLENGE_SECONDS * 1000
    setLeft(CHALLENGE_SECONDS * 1000)
    nextQuestion()
    setPhase('running')
  }

  // The clock: ends the run when time is up and saves the result.
  useEffect(() => {
    if (phase !== 'running') return
    const timer = setInterval(() => {
      const rest = deadline.current - Date.now()
      setLeft(Math.max(0, rest))
      if (rest <= 0) {
        clearInterval(timer)
        clearTimeout(advance.current)
        setPhase('done')
      }
    }, 100)
    return () => clearInterval(timer)
  }, [phase])

  // Save once per run.
  useEffect(() => {
    if (phase !== 'done') return
    haptic([12, 60, 12])
    actions.addTrainingResult('challenge', Math.min(100, score), Math.min(100, Math.max(1, answered)))
  }, [phase])

  useEffect(() => () => clearTimeout(advance.current), [])

  const answer = (option: string) => {
    if (!question || picked !== null) return
    const right = option === question.correct
    setPicked(option)
    setAnswered((n) => n + 1)
    if (right) {
      haptic(12)
      setScore((s) => s + 1)
    } else {
      haptic([30, 60, 30])
      deadline.current -= WRONG_PENALTY_SECONDS * 1000
    }
    // A wrong answer stays a moment longer so you can see the right one.
    advance.current = setTimeout(nextQuestion, right ? 250 : 900)
  }

  const IconCmp = LESSON_ICON.challenge

  if (phase === 'intro')
    return (
      <div className="screen flow done" style={lessonStyle('challenge')}>
        <header className="flow-header">
          <IconButton icon={XIcon} label="Back" onClick={() => navigate('/training')} />
        </header>
        <div className="intro">
          <span className="lesson-icon big" aria-hidden="true">
            <IconCmp weight="fill" />
          </span>
          <h1>Ghalta Rush</h1>
          <p className="lead">{CHALLENGE_SECONDS} seconds of Ghalta Math. Answer as many as you can. A wrong answer costs {WRONG_PENALTY_SECONDS} seconds.</p>
          {bestBefore > 0 && <p className="muted">Your best: {bestBefore} correct</p>}
        </div>
        <footer className="flow-footer">
          <Button block icon={PlayIcon} onClick={start}>
            Start
          </Button>
        </footer>
      </div>
    )

  if (phase === 'done') {
    const newBest = score > bestBefore
    return (
      <div className="screen flow done" style={lessonStyle('challenge')}>
        {newBest && <Confetti />}
        <div className="intro">
          <span className="lesson-icon big" aria-hidden="true">
            <IconCmp weight="fill" />
          </span>
          <h1>{newBest ? 'New best!' : 'Time’s up!'}</h1>
          <p className="lead">
            {score} correct out of {answered}.{!newBest && bestBefore > 0 ? ` Your best is ${bestBefore}.` : ''}
          </p>
        </div>
        <div className="reward-tiles">
          <div className="reward rounds">
            <span className="reward-title">Correct</span>
            <span className="reward-value">{score}</span>
          </div>
          <div className="reward streak">
            <span className="reward-title">Best</span>
            <span className="reward-value">{Math.max(score, bestBefore)}</span>
          </div>
        </div>
        <footer className="flow-footer stack">
          <Button block icon={ArrowRightIcon} onClick={() => navigate('/training', { replace: true })}>
            Continue
          </Button>
          <Button block variant="secondary" icon={ArrowClockwiseIcon} onClick={start}>
            Again
          </Button>
        </footer>
      </div>
    )
  }

  const seconds = Math.ceil(left / 1000)
  return (
    <div className="screen flow lesson challenge" style={lessonStyle('challenge')}>
      <header className="flow-header">
        <IconButton icon={XIcon} label="Stop" onClick={() => navigate('/training')} />
        <ProgressBar value={left / (CHALLENGE_SECONDS * 1000)} label={`${seconds} seconds left`} />
        <span className={`challenge-clock ${seconds <= 10 ? 'low' : ''}`} aria-hidden="true">
          {seconds}
        </span>
      </header>
      {question && (
        <div className="question">
          <span className="eyebrow">{score} correct</span>
          <h1>{question.prompt}</h1>
          <ul className="challenge-board" aria-label="Your creatures on the battlefield">
            {question.board.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <div className="quiz-options two challenge-options" role="radiogroup">
            {question.options.map((o) => {
              const state = picked === null ? '' : o === question.correct ? 'right' : o === picked ? 'wrong' : 'dim'
              return (
                <button key={o} type="button" role="radio" aria-checked={picked === o} className={`option quiz-option ${state}`} disabled={picked !== null} onClick={() => answer(o)}>
                  <AnswerLabel value={o} />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
