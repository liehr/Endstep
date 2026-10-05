import { CardsIcon, FireIcon, TrophyIcon } from '@phosphor-icons/react'
import { today } from '../lib/dates'
import { weekStreak } from '../lib/streak'
import { useData } from '../lib/store'

/** Status bar at the top like Duolingo: streak, games, wins. */
export function TopStats() {
  const { games } = useData()
  const streak = weekStreak(games, today())
  const wins = games.filter((g) => g.result === 'win').length

  return (
    <div className="topstats">
      <img src={`${import.meta.env.BASE_URL}pwa-64x64.png`} alt="Endstep" className="topstats-logo" />
      <div className="topstats-items">
        <span className={`topstat streak ${streak.current > 0 ? 'on' : ''}`} title="Weeks played in a row">
          <FireIcon weight="fill" aria-hidden="true" />
          {streak.current}
          <span className="sr-only"> week streak</span>
        </span>
        <span className="topstat rounds" title="Games played">
          <CardsIcon weight="fill" aria-hidden="true" />
          {games.length}
          <span className="sr-only"> games</span>
        </span>
        <span className="topstat wins" title="Wins">
          <TrophyIcon weight="fill" aria-hidden="true" />
          {wins}
          <span className="sr-only"> wins</span>
        </span>
      </div>
    </div>
  )
}
