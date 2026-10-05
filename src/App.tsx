import { ChartBarIcon, ClockCounterClockwiseIcon, GearSixIcon, HouseIcon, type Icon } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { UpdateBanner } from './components/UpdateBanner'
import { SKILLS } from './lib/content'
import { useRoute } from './lib/route'
import { useToast } from './lib/toast'
import type { SkillId } from './lib/types'
import { GameDetail, GameEdit, History } from './pages/History'
import { Home } from './pages/Home'
import { CheatSheet, GhaltaPage, More } from './pages/More'
import { Round, RoundDone, RoundStart } from './pages/Round'
import { RoundEnd } from './pages/RoundEnd'
import { Stats } from './pages/Stats'

const TABS: { path: string; label: string; icon: Icon }[] = [
  { path: '/', label: 'Start', icon: HouseIcon },
  { path: '/verlauf', label: 'Verlauf', icon: ClockCounterClockwiseIcon },
  { path: '/statistik', label: 'Statistik', icon: ChartBarIcon },
  { path: '/mehr', label: 'Mehr', icon: GearSixIcon },
]

const SKILL_IDS = new Set<string>(SKILLS.map((s) => s.id))

function Page({ route }: { route: string }) {
  let m: RegExpMatchArray | null
  if ((m = route.match(/^\/spiel\/([^/]+)\/bearbeiten$/))) return <GameEdit id={m[1]} />
  if ((m = route.match(/^\/spiel\/([^/]+)$/))) return <GameDetail id={m[1]} />
  if ((m = route.match(/^\/runde\/neu\/([^/]+)$/)) && SKILL_IDS.has(m[1])) return <RoundStart skill={m[1] as SkillId} />
  if ((m = route.match(/^\/runde\/fertig\/([^/]+)$/))) return <RoundDone id={m[1]} />

  switch (route) {
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
    case '/mehr/spickzettel':
      return <CheatSheet />
    case '/mehr/ghalta':
      return <GhaltaPage />
    default:
      return <Home />
  }
}

/** Während einer Runde gibt es keine Tab-Leiste: volle Konzentration auf eine Sache. */
const isFlow = (route: string) => route.startsWith('/runde') || route.endsWith('/bearbeiten')

function activeTab(route: string): string {
  if (route.startsWith('/spiel') || route === '/verlauf') return '/verlauf'
  if (route === '/statistik') return route
  if (route.startsWith('/mehr')) return '/mehr'
  return '/'
}

export function App() {
  const route = useRoute()
  const message = useToast()
  const tab = activeTab(route)
  const flow = isFlow(route)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])

  return (
    <>
      <UpdateBanner />
      <main className={flow ? 'flow-main' : ''}>
        <Page key={route} route={route} />
      </main>
      {message && (
        <div className={`toast ${flow ? 'flow' : ''}`} role="status">
          {message}
        </div>
      )}
      {!flow && (
        <nav className="tabbar" aria-label="Hauptnavigation">
          {TABS.map(({ path, label, icon: IconCmp }) => {
            const active = tab === path
            return (
              <a key={path} href={`#${path}`} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                <span className="tab-icon">
                  <IconCmp weight={active ? 'fill' : 'bold'} aria-hidden="true" />
                </span>
                {label}
              </a>
            )
          })}
        </nav>
      )}
    </>
  )
}
