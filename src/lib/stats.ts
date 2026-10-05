import { BRACKET_CHECK_GAMES, PATTERN_THRESHOLD, SKILLS, UPGRADE_CARDS, UPGRADE_EVERY_GAMES, WHY_CATEGORIES } from './content'
import { sortGames } from './focus'
import type { DeckEntry, Game, Result, SkillId, Swap, WhyCategory } from './types'

export interface Tally {
  name: string
  count: number
}

/** Count card names, ignoring case and surrounding whitespace. */
export function tallyCards(lists: string[][]): Tally[] {
  const counts = new Map<string, Tally>()
  for (const list of lists) {
    // Each card counts only once per game.
    const seen = new Set<string>()
    for (const raw of list) {
      const name = raw.trim()
      const key = name.toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      const entry = counts.get(key)
      if (entry) entry.count++
      else counts.set(key, { name, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'))
}

export interface SkillStat {
  id: SkillId
  games: number
  wins: number
  avgRating: number | null
  /** How often the "one decision" was assigned to this skill. */
  mistakes: number
}

export interface DeckPhase {
  /** "Original" or "After swap 1" … */
  label: string
  from: string | null
  games: number
  wins: number
}

export interface UpgradeStatus {
  /** Games since the last swap round (or in total if there hasn't been one yet). */
  gamesSince: number
  /** After this many games the next swap round is due. */
  target: number
  ready: boolean
  /** Number of the next swap round (1 = first). */
  round: number
  /** Maximum number of cards the next swap round may swap. */
  cards: number
  /** Record per deck version, oldest first. */
  phases: DeckPhase[]
}

export interface BracketCheck {
  games: number
  target: number
  /** Milestone reached and not answered yet. */
  due: boolean
  done: boolean
}

export interface Stats {
  total: number
  wins: number
  winRate: number | null
  /** Results of the last 5 games, newest first. */
  recent: Result[]
  /** Games with the current default deck (for the upgrade roadmap). */
  deckGames: number
  upgradeReady: boolean
  deadCards: Tally[]
  starCards: Tally[]
  /** Cards that were dead often enough to swap them out. */
  upgradeCandidates: Tally[]
  skills: SkillStat[]
  /** Skills where the "one decision" landed at least three times. */
  patterns: SkillStat[]
  whyCounts: { id: WhyCategory; count: number }[]
  avgGhaltaTurn: number | null
  avgTurns: number | null
  avgMulligans: number | null
  upgrade: UpgradeStatus
  wipes: { kept: number; overextended: number }
}

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length === 0) return null
  return nums.reduce((sum, v) => sum + v, 0) / nums.length
}

const normalize = (s: string) => s.trim().toLowerCase()

export function upgradeStatus(deckGames: Game[], swaps: Swap[]): UpgradeStatus {
  const sorted = [...swaps].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const bounds = [null, ...sorted.map((s) => s.date)]
  const phases = bounds.map((from, i) => {
    const to = bounds[i + 1] ?? null
    const games = deckGames.filter((g) => (from === null || g.playedAt >= from) && (to === null || g.playedAt < to))
    return {
      label: i === 0 ? 'Original' : `After swap ${i}`,
      from,
      games: games.length,
      wins: games.filter((g) => g.result === 'win').length,
    }
  })
  const gamesSince = phases[phases.length - 1].games
  const target = UPGRADE_EVERY_GAMES
  return { gamesSince, target, ready: gamesSince >= target, round: swaps.length + 1, cards: swapCards(swaps.length), phases }
}

/** Maximum number of cards for the swap round after `done` completed rounds. */
export function swapCards(done: number): number {
  return UPGRADE_CARDS[Math.min(done, UPGRADE_CARDS.length - 1)]
}

/** "Bracket check" milestone: ask once after enough games with the deck. */
export function bracketCheck(deckGames: number, done: boolean): BracketCheck {
  return { games: deckGames, target: BRACKET_CHECK_GAMES, due: !done && deckGames >= BRACKET_CHECK_GAMES, done }
}

export function computeStats(
  allGames: Game[],
  deck: string,
  { swaps = [], decklist }: { swaps?: Swap[]; decklist?: DeckEntry[] } = {},
): Stats {
  const games = sortGames(allGames)
  const wins = games.filter((g) => g.result === 'win').length
  const deckGames = games.filter((g) => normalize(g.deck) === normalize(deck))

  const deadCards = tallyCards(deckGames.map((g) => g.deadCards))
  const starCards = tallyCards(deckGames.map((g) => g.starCards))

  const skills: SkillStat[] = SKILLS.map(({ id }) => {
    const focused = games.filter((g) => g.focus === id)
    return {
      id,
      games: focused.length,
      wins: focused.filter((g) => g.result === 'win').length,
      avgRating: average(focused.map((g) => g.focusRating)),
      mistakes: games.filter((g) => g.decisionSkill === id).length,
    }
  })

  const upgrade = upgradeStatus(deckGames, swaps)
  const upgradeReady = upgrade.ready
  // Candidates only from cards that are still in the deck.
  const inDeck = decklist ? new Set(decklist.map((e) => normalize(e.name))) : null

  return {
    total: games.length,
    wins,
    winRate: games.length ? wins / games.length : null,
    recent: games.slice(0, 5).map((g) => g.result),
    deckGames: deckGames.length,
    upgradeReady,
    deadCards,
    starCards,
    upgradeCandidates: deadCards.filter((c) => c.count >= PATTERN_THRESHOLD && (!inDeck || inDeck.has(normalize(c.name)))),
    skills,
    patterns: skills
      .filter((s) => s.mistakes >= PATTERN_THRESHOLD)
      .sort((a, b) => b.mistakes - a.mistakes),
    whyCounts: WHY_CATEGORIES.map(({ id }) => ({
      id,
      count: games.filter((g) => g.result === 'loss' && g.whyCategory === id).length,
    })),
    avgGhaltaTurn: average(games.map((g) => g.ghaltaTurn)),
    avgTurns: average(games.map((g) => g.turns)),
    avgMulligans: average(games.map((g) => g.mulligans)),
    wipes: {
      kept: games.filter((g) => g.wipe === 'kept').length,
      overextended: games.filter((g) => g.wipe === 'overextended').length,
    },
    upgrade,
  }
}
