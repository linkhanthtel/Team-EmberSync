import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Check, Eye, Flame, Gavel, MapPinned, PanelLeftClose, PanelLeftOpen, Satellite, X, type LucideIcon } from 'lucide-react'
import { CALENDAR, FIRE_CENTRES, shortCentre, type CentreSel } from '../lib/fire.ts'
import { CENTRE_COLOR, fmtCompact } from '../lib/theme.ts'

export type Route = 'scan' | 'spot' | 'block' | 'watch' | 'call'

export const NAV: { id: Route; label: string; hint: string; icon: LucideIcon; done?: boolean }[] = [
  { id: 'scan', label: 'Scan', hint: 'World fire data', icon: Satellite, done: true },
  { id: 'spot', label: 'Spot', hint: 'BC fire centres', icon: MapPinned, done: true },
  { id: 'block', label: 'Block', hint: 'Fire calendar', icon: CalendarDays },
  { id: 'watch', label: 'Watch', hint: 'Month map + lone dots', icon: Eye },
  { id: 'call', label: 'Make the call', hint: 'Insights', icon: Gavel },
]

// All-time harmonised hotspots per centre, for the picker.
const CENTRE_TOTAL = Object.fromEntries(FIRE_CENTRES.map((c) => [c, CALENDAR.filter((r) => r.centre === c).reduce((s, r) => s + r.count, 0)]))

interface Props {
  route: Route
  onNavigate: (r: Route) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  centre: CentreSel
  onCentre: (c: CentreSel) => void
}

export function Sidebar(props: Props) {
  return (
    <>
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-line bg-surface/70 backdrop-blur-xl transition-[width] duration-300 ${
          props.collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <SidebarBody {...props} collapsed={props.collapsed} />
      </aside>

      <AnimatePresence>
        {props.mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={props.onCloseMobile} />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col border-r border-line bg-surface"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            >
              <button onClick={props.onCloseMobile} className="absolute right-3 top-5 p-2 rounded-md text-muted hover:text-ink hover:bg-white/5" aria-label="Close menu">
                <X className="size-4" />
              </button>
              <SidebarBody {...props} collapsed={false} mobile />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

function SidebarBody({ route, onNavigate, collapsed, onToggleCollapsed, onCloseMobile, centre, onCentre, mobile }: Props & { mobile?: boolean }) {
  const go = (r: Route) => {
    onNavigate(r)
    onCloseMobile()
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className={`flex items-center gap-3 h-[76px] shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
        <div className="size-10 shrink-0 rounded-xl bg-gradient-to-br from-ember to-[#c2410c] grid place-items-center shadow-lg shadow-ember/30">
          <Flame className="size-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-tight leading-none">EmberSync</div>
            <div className="text-[11px] text-muted mt-1">BC fire calendar · 2001–2025</div>
          </div>
        )}
      </div>

      <nav className="px-3 space-y-1" aria-label="Moves">
        {!collapsed && <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-muted">Five moves</div>}
        {NAV.map((n, i) => {
          const active = route === n.id
          return (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              title={collapsed ? `${n.label}${n.done ? ' (done)' : ''}` : undefined}
              aria-current={active ? 'page' : undefined}
              className={`relative w-full flex items-center gap-3 rounded-lg h-11 text-sm transition-colors ${collapsed ? 'justify-center' : 'px-3'} ${
                active ? 'bg-white/[0.07] text-ink' : n.done ? 'text-muted hover:bg-white/5 hover:text-ink-2' : 'text-ink-2 hover:bg-white/5 hover:text-ink'
              }`}
            >
              {active && <motion.span layoutId="nav-active" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-ember" />}
              <n.icon className={`size-[18px] shrink-0 ${active ? 'text-ember' : n.done ? 'opacity-60' : ''}`} />
              {!collapsed && (
                <span className="flex-1 min-w-0 text-left">
                  <span className="block leading-tight">
                    <span className="text-[10px] text-muted tabular mr-1.5">{i + 1}</span>
                    {n.label}
                  </span>
                  <span className="block text-[10px] text-muted leading-tight truncate">{n.hint}</span>
                </span>
              )}
              {n.done &&
                (collapsed ? (
                  <span className="absolute top-1.5 right-3.5 size-3 rounded-full bg-[#0ca30c]/25 grid place-items-center">
                    <Check className="size-2 text-[#5fd35f]" strokeWidth={4} />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[#0ca30c]/15 text-[#5fd35f] px-1.5 py-0.5 text-[10px]">
                    <Check className="size-2.5" strokeWidth={3} /> done
                  </span>
                ))}
            </button>
          )
        })}
      </nav>

      <div className={`mt-6 px-3 ${collapsed ? 'hidden' : ''}`}>
        <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-muted flex justify-between">
          <span>Fire centre</span>
          <span className="normal-case tracking-normal">hotspots</span>
        </div>
        <ul className="space-y-0.5">
          {[null, ...FIRE_CENTRES].map((c) => {
            const on = centre === c
            return (
              <li key={c ?? 'all'}>
                <button
                  onClick={() => {
                    onCentre(c)
                    onCloseMobile()
                  }}
                  aria-pressed={on}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-left group ${on ? 'bg-white/[0.07]' : 'hover:bg-white/5'}`}
                >
                  <span
                    className="size-2.5 rounded-sm shrink-0"
                    style={c ? { background: CENTRE_COLOR[c] } : { background: 'conic-gradient(#3987e5, #d95926, #199e70, #c98500, #d55181, #0ca30c, #3987e5)' }}
                  />
                  <span className={`flex-1 text-xs truncate ${on ? 'text-ink font-medium' : 'text-ink-2 group-hover:text-ink'}`}>{c ? shortCentre(c) : 'All of BC'}</span>
                  <span className="text-[10px] text-muted tabular">
                    {fmtCompact(c ? CENTRE_TOTAL[c] : Object.values(CENTRE_TOTAL).reduce((a, b) => a + b, 0))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-auto p-3 space-y-2">
        {!collapsed && <p className="px-3 text-[10px] leading-relaxed text-muted">Data: NASA FIRMS (MODIS C6.1, VIIRS S-NPP 375 m). Harmonised counts.</p>}
        {!mobile && (
          <button
            onClick={onToggleCollapsed}
            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted hover:text-ink hover:bg-white/5 ${collapsed ? 'justify-center px-0' : ''}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && 'Collapse'}
          </button>
        )}
      </div>
    </div>
  )
}

export function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <div className="lg:hidden sticky top-0 z-20 flex items-center gap-3 h-14 px-4 border-b border-line bg-bg/80 backdrop-blur-xl">
      <button onClick={onMenu} className="p-2 -ml-2 rounded-md text-ink-2 hover:bg-white/5" aria-label="Open menu">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>
      <div className="flex items-center gap-2 mr-auto">
        <div className="size-7 rounded-lg bg-gradient-to-br from-ember to-[#c2410c] grid place-items-center">
          <Flame className="size-4 text-white" />
        </div>
        <span className="font-semibold text-sm">EmberSync</span>
      </div>
    </div>
  )
}
