import { boardPower, isCreature, type CardInfo } from '../cards'
import { ghaltaCost } from '../ghalta'
import { shuffle, type Rng } from '../sim/rng'
import { int, pick, type QuizContext } from './question'

// Ghalta Math against the clock: short questions you can answer at a glance, as many as
// you can in 60 seconds. The best score lives in the training results.

export const CHALLENGE_SECONDS = 60
/** A wrong answer takes this much off the clock, so guessing doesn't pay. */
export const WRONG_PENALTY_SECONDS = 3

export interface ChallengeQuestion {
  prompt: string
  /** Creatures on the battlefield as "Name 5/4" or "a 5/5". */
  board: string[]
  options: string[]
  correct: string
}

/** Ghalta's cost as mana symbols, e.g. {4}{G}{G}. */
export const costSymbols = (generic: number) => `${generic > 0 ? `{${generic}}` : ''}{G}{G}`

const castLine = (casts: number) =>
  casts === 0 ? 'Not cast yet.' : casts === 1 ? 'Cast once before (+2 tax).' : `Cast ${casts} times before (+${2 * casts} tax).`

function creaturesOf(ctx: Pick<QuizContext, 'decklist' | 'lookup'>): CardInfo[] {
  const seen = new Set<string>()
  return ctx.decklist
    .map((e) => ctx.lookup(e.name))
    .filter((c): c is CardInfo => !!c && isCreature(c) && c.power !== null && !/^Ghalta\b/.test(c.name) && !seen.has(c.name) && (seen.add(c.name), true))
}

/** Correct answer plus three distinct wrong ones nearby, shuffled. */
function options(correct: number, wrong: number[], format: (n: number) => string, rng: Rng): { options: string[]; correct: string } {
  const out = new Set([format(correct)])
  for (const w of shuffle(wrong, rng)) if (w >= 0 && out.size < 4) out.add(format(w))
  for (let d = 1; out.size < 4; d++) out.add(format(correct + d))
  return { options: shuffle([...out], rng), correct: format(correct) }
}

/** A random question; uses your deck's creatures when there are enough. */
export function challengeQuestion(ctx: Pick<QuizContext, 'decklist' | 'lookup'>, rng: Rng): ChallengeQuestion {
  const deck = creaturesOf(ctx)
  const size = int(1, 4, rng)
  const board =
    deck.length >= 4
      ? shuffle(deck, rng)
          .slice(0, size)
          .map((c) => ({ label: `${c.name} ${c.powerText}/${c.toughness}`, power: boardPower(c, 0) }))
      : Array.from({ length: size }, () => {
          const p = int(1, 7, rng)
          return { label: `a ${p}/${p}`, power: p }
        })
  const power = board.reduce((s, c) => s + c.power, 0)
  const casts = pick([0, 0, 1, 1, 2], rng)
  const cost = ghaltaCost(power, casts)
  const labels = board.map((c) => c.label)

  if (rng() < 0.3) {
    // How much power is still missing for GG?
    const missing = cost.missingPowerForGG
    return {
      prompt: `${castLine(casts)} How much more power until Ghalta costs only GG?`,
      board: labels,
      ...options(missing, [missing + 2, missing - 2, 10 - power, missing + 1, missing - 1], String, rng),
    }
  }
  return {
    prompt: `${castLine(casts)} What does Ghalta cost?`,
    board: labels,
    ...options(cost.generic, [Math.max(0, 10 - power), 10 + 2 * casts, cost.generic + 2, cost.generic - 2, cost.generic + 1], costSymbols, rng),
  }
}

/** Best score so far (correct answers in one run). */
export function challengeBest(training: { lessonId: string; correct: number }[]): number {
  return training.filter((t) => t.lessonId === 'challenge').reduce((m, t) => Math.max(m, t.correct), 0)
}
