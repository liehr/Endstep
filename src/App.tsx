import { BarbellIcon, ChartBarIcon, ClockCounterClockwiseIcon, GearSixIcon, HouseIcon, type Icon } from '@phosphor-icons/react'
import { lazy, Suspense, useEffect } from 'react'
import { UpdateBanner } from './components/UpdateBanner'
import { SKILLS } from './lib/content'
import { useRoute } from './lib/route'
import { useData } from './lib/store'
import { useToast } from './lib/toast'
import type { LessonId, SkillId } from './lib/types'
import { LESSON_BY_ID } from './lib/quiz/quiz'
import { GameDetail, GameEdit, History } from './pages/History'
import { Home } from './pages/Home'
import { CheatSheet, GhaltaPage, More } from './pages/More'
import { Round, RoundDone, RoundStart } from './pages/Round'
import { RoundEnd } from './pages/RoundEnd'
import { Stats } from './pages/Stats'

// Load Training and Deck only when needed (faster startup); offline they live in the service worker cache.
const Training = lazy(() => import('./pages/Training').then((m) => ({ default: m.Training })))
const Lesson = lazy(() => import('./pages/Lesson').then((m) => ({ default: m.Lesson })))
const DeckPage = lazy(() => import('./pages/Deck').then((m) => ({ default: m.DeckPage })))
const SwapFlow = lazy(() => import('./pages/Deck').then((m) => ({ default: m.SwapFlow })))
const DeckPicker = lazy(() => import('./pages/DeckPicker').then((m) => ({ default: m.DeckPicker })))

const TABS: { path: string; label: string; icon: Icon }[] = [
  { path: '/', label: 'Home', icon: HouseIcon },
  { path: '/training', label: 'Training', icon: BarbellIcon },
  { path: '/verlauf', label: 'History', icon: ClockCounterClockwiseIcon },
  { path: '/statistik', label: 'Stats', icon: ChartBarIcon },
  { path: '/mehr', label: 'More', icon: GearSixIcon },
]

const SKILL_IDS = new Set<string>(SKILLS.map((s) => s.id))

function Page({ route }: { route: string }) {
  let m: RegExpMatchArray | null
  if ((m = route.match(/^\/spiel\/([^/]+)\/bearbeiten$/))) return <GameEdit id={m[1]} />
  if ((m = route.match(/^\/spiel\/([^/]+)$/))) return <GameDetail id={m[1]} />
  if ((m = route.match(/^\/runde\/neu\/([^/]+)$/)) && SKILL_IDS.has(m[1])) return <RoundStart skill={m[1] as SkillId} />
  if ((m = route.match(/^\/runde\/fertig\/([^/]+)$/))) return <RoundDone id={m[1]} />
  if ((m = route.match(/^\/training\/([^/]+)$/)) && m[1] in LESSON_BY_ID) return <Lesson id={m[1] as LessonId} />

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
    case '/mehr/deck':
      return <DeckPage />
    case '/mehr/deck/swap':
      return <SwapFlow />
    case '/mehr/deck/wechseln':
      return <DeckPicker />
    case '/training':
      return <Training />
    default:
      return <Home />
  }
}

/** No tab bar during a game: full focus on one thing. */
const isFlow = (route: string) =>
  route.startsWith('/runde') || route.endsWith('/bearbeiten') || route.startsWith('/training/') || route === '/mehr/deck/swap'

function activeTab(route: string): string {
  if (route.startsWith('/spiel') || route === '/verlauf') return '/verlauf'
  if (route === '/statistik') return route
  if (route.startsWith('/training')) return '/training'
  if (route.startsWith('/mehr')) return '/mehr'
  return '/'
}

export function App() {
  const route = useRoute()
  const message = useToast()
  const { deckChosen } = useData()
  const tab = activeTab(route)
  // First launch: pick a deck before anything else, without the tab bar.
  const flow = isFlow(route) || !deckChosen

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])

  return (
    <>
      <UpdateBanner />
      <main className={flow ? 'flow-main' : ''}>
        <Suspense fallback={null}>
          {deckChosen ? <Page key={route} route={route} /> : <DeckPicker welcome />}
        </Suspense>
      </main>
      {message && (
        <div className={`toast ${flow ? 'flow' : ''}`} role="status">
          {message}
        </div>
      )}
      {!flow && (
        <nav className="tabbar" aria-label="Main navigation">
          {/* Only visible as a sidebar on wide screens (tablet landscape, desktop). */}
          <a href="#/" className="tabbar-brand" aria-hidden="true" tabIndex={-1}>
            <img src={`${import.meta.env.BASE_URL}pwa-64x64.png`} alt="" />
            Endstep
          </a>
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
