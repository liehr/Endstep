import { CardsIcon, FireIcon, TrophyIcon } from '@phosphor-icons/react'
import { today } from '../lib/dates'
import { weekStreak } from '../lib/streak'
import { useData } from '../lib/store'

/** Statusleiste oben wie bei Duolingo: Serie, Runden, Siege. */
export function TopStats() {
  const { games } = useData()
  const streak = weekStreak(games, today())
  const wins = games.filter((g) => g.result === 'win').length

  return (
    <div className="topstats">
      <img src={`${import.meta.env.BASE_URL}pwa-64x64.png`} alt="Endstep" className="topstats-logo" />
      <div className="topstats-items">
        <span className={`topstat streak ${streak.current > 0 ? 'on' : ''}`} title="Wochen in Folge gespielt">
          <FireIcon weight="fill" aria-hidden="true" />
          {streak.current}
          <span className="sr-only"> Wochen Serie</span>
        </span>
        <span className="topstat rounds" title="Runden gespielt">
          <CardsIcon weight="fill" aria-hidden="true" />
          {games.length}
          <span className="sr-only"> Runden</span>
        </span>
        <span className="topstat wins" title="Siege">
          <TrophyIcon weight="fill" aria-hidden="true" />
          {wins}
          <span className="sr-only"> Siege</span>
        </span>
      </div>
    </div>
  )
}
