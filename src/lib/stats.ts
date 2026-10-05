import { PATTERN_THRESHOLD, SKILLS, UPGRADE_AFTER_GAMES, WHY_CATEGORIES } from './content'
import { sortGames } from './focus'
import type { Game, Result, SkillId, WhyCategory } from './types'

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
  avgMulligans: number | null
  wipes: { kept: number; overextended: number }
}

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length === 0) return null
  return nums.reduce((sum, v) => sum + v, 0) / nums.length
}

const normalize = (s: string) => s.trim().toLowerCase()

export function computeStats(allGames: Game[], deck: string): Stats {
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

  const upgradeReady = deckGames.length >= UPGRADE_AFTER_GAMES

  return {
    total: games.length,
    wins,
    winRate: games.length ? wins / games.length : null,
    recent: games.slice(0, 5).map((g) => g.result),
    deckGames: deckGames.length,
    upgradeReady,
    deadCards,
    starCards,
    upgradeCandidates: deadCards.filter((c) => c.count >= PATTERN_THRESHOLD),
    skills,
    patterns: skills
      .filter((s) => s.mistakes >= PATTERN_THRESHOLD)
      .sort((a, b) => b.mistakes - a.mistakes),
    whyCounts: WHY_CATEGORIES.map(({ id }) => ({
      id,
      count: games.filter((g) => g.result === 'loss' && g.whyCategory === id).length,
    })),
    avgGhaltaTurn: average(games.map((g) => g.ghaltaTurn)),
    avgMulligans: average(games.map((g) => g.mulligans)),
    wipes: {
      kept: games.filter((g) => g.wipe === 'kept').length,
      overextended: games.filter((g) => g.wipe === 'overextended').length,
    },
  }
}
