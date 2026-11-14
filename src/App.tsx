import { useCallback, useEffect, useState } from 'react'
import { Footer } from './components/Footer.tsx'
import { MobileTopBar, NAV, Sidebar, type Route } from './components/Sidebar.tsx'
import { CALENDAR, FIRE_CENTRES, calendarCell, shortCentre, type CentreSel, type Metric } from './lib/fire.ts'
import { Block } from './screens/Block.tsx'
import { Call } from './screens/Call.tsx'
import { Scan } from './screens/Scan.tsx'
import { Spot } from './screens/Spot.tsx'
import { Watch } from './screens/Watch.tsx'

const PAGE_META: Record<Route, { title: string; subtitle: string }> = {
  scan: { title: 'Scan', subtitle: "How we scanned the world's fire data, and why the MODIS record matters now" },
  spot: { title: 'Spot', subtitle: 'British Columbia and its six fire centres' },
  block: { title: 'Block', subtitle: 'The fire calendar: month against year, 2001–2025, on one harmonised scale' },
  watch: { title: 'Watch', subtitle: "One month's hotspots on the map, with lone dots on the watch list" },
  call: { title: 'Make the call', subtitle: 'One-line insights per fire centre and month' },
}

// Open Watch on the busiest month in BC's record.
const PEAK_YM = [...new Set(CALENDAR.map((r) => r.ym))].reduce((a, b) => (calendarCell(null, b).count > calendarCell(null, a).count ? b : a))

function useHashRoute(): [Route, (r: Route) => void] {
  const parse = () => {
    const r = window.location.hash.replace(/^#\/?/, '') as Route
    return NAV.some((n) => n.id === r) ? r : 'block'
  }
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const onHash = () => setRoute(parse())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = useCallback((r: Route) => {
    window.location.hash = `/${r}`
    window.scrollTo({ top: 0 })
  }, [])
  return [route, navigate]
}

function usePersistent<T>(key: string, initial: T, valid: (v: unknown) => v is T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      const parsed: unknown = raw == null ? initial : JSON.parse(raw)
      return valid(parsed) ? parsed : initial
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (x: T) => {
      setV(x)
      try {
        localStorage.setItem(key, JSON.stringify(x))
      } catch {
        /* storage unavailable */
      }
    },
    [key],
  )
  return [v, set]
}

const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isCentre = (v: unknown): v is CentreSel => v === null || (FIRE_CENTRES as readonly unknown[]).includes(v)
const isMetric = (v: unknown): v is Metric => v === 'count' || v === 'energy'

export default function App() {
  const [route, navigate] = useHashRoute()
  const [collapsed, setCollapsed] = usePersistent('ember.sidebarCollapsed', false, isBool)
  const [centre, setCentre] = usePersistent<CentreSel>('ember.centre', null, isCentre)
  const [metric, setMetric] = usePersistent<Metric>('ember.metric', 'count', isMetric)
  const [mobileNav, setMobileNav] = useState(false)
  const [ym, setYm] = useState(PEAK_YM)

  const openMonth = (m: string) => {
    setYm(m)
    navigate('watch')
  }
  const meta = PAGE_META[route]

  return (
    <div className="min-h-screen">
      <Sidebar
        route={route}
        onNavigate={navigate}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
        centre={centre}
        onCentre={setCentre}
      />

      <div className={`transition-[padding] duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        <MobileTopBar onMenu={() => setMobileNav(true)} />

        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-end gap-4 pt-6 pb-5">
            <div className="mr-auto min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">{meta.title}</h1>
              <p className="text-xs text-muted mt-1">{meta.subtitle}</p>
            </div>
            {route !== 'scan' && (
              <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 h-8 text-xs text-ink-2">
                <span className="text-muted">Fire centre</span>
                {centre ? shortCentre(centre) : 'All of BC'}
              </span>
            )}
          </header>

          <main className="space-y-5">
            {route === 'scan' && <Scan />}
            {route === 'spot' && <Spot centre={centre} onCentre={setCentre} />}
            {route === 'block' && <Block centre={centre} metric={metric} onMetric={setMetric} selected={ym} onOpenMonth={openMonth} />}
            {route === 'watch' && <Watch centre={centre} onCentre={setCentre} metric={metric} onMetric={setMetric} ym={ym} onYm={setYm} />}
            {route === 'call' && <Call centre={centre} onOpenMonth={openMonth} />}
          </main>

          <Footer />
        </div>
      </div>
    </div>
  )
}
