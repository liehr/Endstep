import { useEffect } from 'react'
import { GhaltaCalculator } from './components/GhaltaCalculator'
import { UpdateBanner } from './components/UpdateBanner'
import { navigate, useRoute } from './lib/route'
import { useToast } from './lib/toast'
import { GameDetail, GameEdit, History } from './pages/History'
import { Home } from './pages/Home'
import { More } from './pages/More'
import { Round, RoundEnd } from './pages/Round'
import { Stats } from './pages/Stats'

const TABS = [
  { path: '/', label: 'Start', icon: '🦖' },
  { path: '/verlauf', label: 'Verlauf', icon: '📜' },
  { path: '/statistik', label: 'Statistik', icon: '📊' },
  { path: '/mehr', label: 'Mehr', icon: '⚙️' },
]

function Page({ route }: { route: string }) {
  const game = route.match(/^\/spiel\/([^/]+)(\/bearbeiten)?$/)
  if (game) return game[2] ? <GameEdit id={game[1]} /> : <GameDetail id={game[1]} />

  switch (route) {
    case '/':
      return <Home />
    case '/runde':
      return <Round />
    case '/runde/ende':
      return <RoundEnd />
    case '/verlauf':
      return <History />
    case '/statistik':
      return <Stats />
    case '/mehr':
      return <More />
    case '/ghalta':
      return (
        <div className="page">
          <header className="page-header">
            <button type="button" className="text back" onClick={() => navigate('/')}>
              ‹ Start
            </button>
          </header>
          <GhaltaCalculator />
        </div>
      )
    default:
      return <Home />
  }
}

function activeTab(route: string): string {
  if (route.startsWith('/spiel') || route === '/verlauf') return '/verlauf'
  if (route === '/statistik' || route === '/mehr') return route
  return '/'
}

export function App() {
  const route = useRoute()
  const message = useToast()
  const tab = activeTab(route)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])

  return (
    <>
      <UpdateBanner />
      <main>
        <Page route={route} />
      </main>
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      <nav className="tabbar">
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} className={tab === t.path ? 'active' : ''}>
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </a>
        ))}
      </nav>
    </>
  )
}
