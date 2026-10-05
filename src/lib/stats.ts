import { PATTERN_THRESHOLD, SKILLS, UPGRADE_AFTER_GAMES, UPGRADE_AFTER_SWAP_GAMES, WHY_CATEGORIES } from './content'
import { sortGames } from './focus'
import type { DeckEntry, Game, Result, SkillId, Swap, WhyCategory } from './types'

export interface Tally {
  name: string
  count: number
}

/** Kartennamen zählen, ohne Groß-/Kleinschreibung und Leerzeichen zu unterscheiden. */
export function tallyCards(lists: string[][]): Tally[] {
  const counts = new Map<string, Tally>()
  for (const list of lists) {
    // Pro Spiel zählt jede Karte nur einmal.
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
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'))
}

export interface SkillStat {
  id: SkillId
  games: number
  wins: number
  avgRating: number | null
  /** Wie oft die „eine Entscheidung“ diesem Skill zugeordnet wurde. */
  mistakes: number
}

export interface DeckPhase {
  /** „Original“ oder „Nach Swap 1“ … */
  label: string
  from: string | null
  games: number
  wins: number
}

export interface UpgradeStatus {
  /** Spiele seit der letzten Swap-Runde (bzw. insgesamt, wenn es noch keine gab). */
  gamesSince: number
  /** Ab so vielen Spielen ist die nächste Swap-Runde dran. */
  target: number
  ready: boolean
  /** Spielstand je Deckversion, älteste zuerst. */
  phases: DeckPhase[]
}

export interface Stats {
  total: number
  wins: number
  winRate: number | null
  /** Ergebnisse der letzten 5 Spiele, neuestes zuerst. */
  recent: Result[]
  /** Spiele mit dem aktuellen Standard-Deck (für den Upgrade-Fahrplan). */
  deckGames: number
  upgradeReady: boolean
  deadCards: Tally[]
  starCards: Tally[]
  /** Karten, die oft genug tot waren, um sie auszutauschen. */
  upgradeCandidates: Tally[]
  skills: SkillStat[]
  /** Skills, bei denen die „eine Entscheidung“ mindestens dreimal gelandet ist. */
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
      label: i === 0 ? 'Original' : `Nach Swap ${i}`,
      from,
      games: games.length,
      wins: games.filter((g) => g.result === 'win').length,
    }
  })
  const gamesSince = phases[phases.length - 1].games
  const target = swaps.length === 0 ? UPGRADE_AFTER_GAMES : UPGRADE_AFTER_SWAP_GAMES
  return { gamesSince, target, ready: gamesSince >= target, phases }
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
  // Kandidaten nur aus Karten, die noch im Deck sind.
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
