import { ArrowRight, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AiBriefing } from './components/AiBriefing.tsx'
import { AiSearch } from './components/AiSearch.tsx'
import { ChartCard, Heatmap, RankedBars, ResponseTrend, TimelineChart } from './components/charts.tsx'
import { EventsTable } from './components/EventsTable.tsx'
import { FilterBar } from './components/FilterBar.tsx'
import { Footer } from './components/Footer.tsx'
import { Kpis } from './components/Kpis.tsx'
import { MobileTopBar, NAV, Sidebar, type Route } from './components/Sidebar.tsx'
import { SiteCards } from './components/SiteCards.tsx'
import { WorldMap, siteStats } from './components/WorldMap.tsx'
import rawData from './data/alarms.json'
import { useAiStatus, useBriefing } from './lib/ai.ts'
import {
  applyFilters,
  countBy,
  dailyBySeverity,
  fmtDuration,
  hourHeatmap,
  kpis,
  responseByBuilding,
  weeklyResponse,
} from './lib/analytics.ts'
import { CHART, shortDate } from './lib/theme.ts'
import {
  ALARM_TYPES,
  BUILDINGS,
  EMPTY_FILTERS,
  type AiMode,
  type AlarmDataset,
  type Building,
  type Filters,
  type SearchResult,
} from './lib/types.ts'

const data = rawData as AlarmDataset
const TODAY = data.rangeEnd.slice(0, 10)
const START = data.rangeStart.slice(0, 10)

const PAGE_META: Record<Route, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'Alarm activity, trends and response performance across all sites' },
  map: { title: 'Global map', subtitle: 'Where alarms are happening across your portfolio' },
  events: { title: 'Event log', subtitle: 'Every alarm event, filterable and searchable' },
}

function useHashRoute(): [Route, (r: Route) => void] {
  const parse = () => {
    const r = window.location.hash.replace(/^#\/?/, '') as Route
    return NAV.some((n) => n.id === r) ? r : 'overview'
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

function usePersistentFlag(key: string, initial: boolean): [boolean, () => void] {
  const [v, setV] = useState(() => {
    try {
      return localStorage.getItem(key) === null ? initial : localStorage.getItem(key) === '1'
    } catch {
      return initial
    }
  })
  const toggle = () =>
    setV((x) => {
      try {
        localStorage.setItem(key, x ? '0' : '1')
      } catch {
        /* storage unavailable */
      }
      return !x
    })
  return [v, toggle]
}

export default function App() {
  const status = useAiStatus()
  const [route, navigate] = useHashRoute()
  const [collapsed, toggleCollapsed] = usePersistentFlag('ember.sidebarCollapsed', false)
  const [mobileNav, setMobileNav] = useState(false)
  const [mode, setMode] = useState<AiMode>('demo')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [aiInterpretation, setAiInterpretation] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const briefing = useBriefing()

  // Default to live Claude when the server has a key.
  useEffect(() => {
    if (status?.live) setMode('live')
  }, [status?.live])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const events = useMemo(() => applyFilters(data.events, filters), [filters])
  const view = useMemo(
    () => ({
      kpis: kpis(events),
      daily: dailyBySeverity(events, filters.dateFrom ?? START, filters.dateTo ?? TODAY),
      types: countBy(events, (e) => e.type, ALARM_TYPES),
      buildings: countBy(events, (e) => e.building, BUILDINGS),
      heat: hourHeatmap(events),
      response: responseByBuilding(events).filter((r) => r.n > 0),
      weekly: weeklyResponse(events),
      sites: siteStats(events),
    }),
    [events, filters.dateFrom, filters.dateTo],
  )
  // Sidebar site status always reflects all open alarms, independent of filters.
  const openBySite = useMemo(
    () => Object.fromEntries(BUILDINGS.map((b) => [b, data.events.filter((e) => e.building === b && e.status !== 'Resolved').length])) as Record<Building, number>,
    [],
  )

  const updateFilters = (f: Filters) => {
    setFilters(f)
    setAiInterpretation(null)
  }
  const toggle = <K extends 'buildings' | 'types'>(key: K, v: Filters[K][number]) => {
    const cur = filters[key] as string[]
    updateFilters({ ...filters, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] })
  }
  const applySearch = (r: SearchResult) => {
    setFilters(r.filters)
    setAiInterpretation(r.interpretation)
  }
  const focusSite = (b: Building) => updateFilters({ ...filters, buildings: [b] })

  const meta = PAGE_META[route]

  return (
    <div className="min-h-screen">
      <Sidebar
        route={route}
        onNavigate={navigate}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
        onOpenSearch={() => setSearchOpen(true)}
        mode={mode}
        setMode={setMode}
        liveAvailable={!!status?.live}
        openBySite={openBySite}
        onSiteClick={focusSite}
      />

      <div className={`transition-[padding] duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        <MobileTopBar onMenu={() => setMobileNav(true)} onSearch={() => setSearchOpen(true)} />

        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          {/* Page header */}
          <header className="flex flex-wrap items-center gap-4 pt-6 pb-5">
            <div className="mr-auto min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">{meta.title}</h1>
              <p className="text-xs text-muted mt-1">
                {meta.subtitle} · {shortDate(START)} – {shortDate(TODAY)}
              </p>
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="ai-ring hidden lg:flex w-[420px] items-center gap-3 rounded-xl bg-surface/80 backdrop-blur px-4 h-11 text-sm text-muted hover:text-ink-2 transition-colors"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left truncate">Ask AI: “open alarms in Europe this week”</span>
              <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[11px]">⌘K</kbd>
            </button>
          </header>

          <main className="space-y-5">
            <FilterBar
              filters={filters}
              setFilters={updateFilters}
              today={TODAY}
              aiInterpretation={aiInterpretation}
              onClearAi={() => {
                if (aiInterpretation) setFilters(EMPTY_FILTERS)
                setAiInterpretation(null)
              }}
            />

            {route === 'overview' && (
              <>
                <Kpis k={view.kpis} />

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  <div className="xl:col-span-2">
                    <ChartCard title="Events over time" subtitle="Daily alarm events by severity">
                      <TimelineChart data={view.daily} />
                    </ChartCard>
                  </div>
                  <div className="xl:row-span-2">
                    <AiBriefing
                      {...briefing}
                      scopeCount={events.length}
                      model={status?.model === 'claude-opus-5-5' ? 'Claude Opus 5.5' : status?.model}
                      onGenerate={() => briefing.run(filters, mode)}
                      onStop={briefing.stop}
                    />
                  </div>
                  <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <ChartCard title="Alarm types" subtitle="Click a bar to filter">
                      <RankedBars data={view.types} onSelect={(n) => toggle('types', n as (typeof ALARM_TYPES)[number])} selected={filters.types} />
                    </ChartCard>
                    <ChartCard title="Events by building" subtitle="Click a bar to filter">
                      <RankedBars data={view.buildings} onSelect={(n) => toggle('buildings', n as Building)} selected={filters.buildings} />
                    </ChartCard>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  <div className="xl:col-span-2">
                    <ChartCard
                      title="Global footprint"
                      subtitle="Alarm volume by site · click a site to filter"
                      right={
                        <button onClick={() => navigate('map')} className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-ember-2 hover:underline">
                          Open map <ArrowRight className="size-3.5" />
                        </button>
                      }
                    >
                      <WorldMap events={events} selected={filters.buildings} onSelect={(b) => toggle('buildings', b)} showControls={false} />
                    </ChartCard>
                  </div>
                  <ChartCard title="When alarms happen" subtitle="Weekday × hour of day (UTC)">
                    <Heatmap grid={view.heat} />
                  </ChartCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <ChartCard title="Avg response by building" subtitle="Time from alarm to acknowledgement">
                    <RankedBars data={view.response} color={CHART.ai} format={fmtDuration} />
                  </ChartCard>
                  <ChartCard title="Response time trend" subtitle="Weekly average">
                    <ResponseTrend data={view.weekly} />
                  </ChartCard>
                </div>
              </>
            )}

            {route === 'map' && (
              <>
                <section className="card p-4 sm:p-5">
                  <WorldMap events={events} selected={filters.buildings} onSelect={(b) => toggle('buildings', b)} />
                </section>
                <SiteCards
                  stats={view.sites}
                  events={events}
                  selected={filters.buildings}
                  onSelect={(b) => toggle('buildings', b)}
                  onViewEvents={(b) => {
                    focusSite(b)
                    navigate('events')
                  }}
                />
              </>
            )}

            {route === 'events' && (
              <>
                <Kpis k={view.kpis} />
                <EventsTable events={events} />
              </>
            )}
          </main>

          <Footer rangeStart={shortDate(START)} rangeEnd={shortDate(TODAY)} />
        </div>
      </div>

      <AiSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        mode={mode}
        events={data.events}
        onApply={applySearch}
        onSummarize={(r) => {
          applySearch(r)
          navigate('overview')
          briefing.run(r.filters, mode)
        }}
      />
    </div>
  )
}
