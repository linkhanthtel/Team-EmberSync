import { AnimatePresence, motion } from 'framer-motion'
import { Flame, Globe2, LayoutDashboard, List, PanelLeftClose, PanelLeftOpen, Search, Sparkles, X, type LucideIcon } from 'lucide-react'
import { SITES } from '../lib/sites.ts'
import { BUILDINGS, type AiMode, type Building } from '../lib/types.ts'

export type Route = 'overview' | 'map' | 'events'

export const NAV: { id: Route; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Global map', icon: Globe2 },
  { id: 'events', label: 'Event log', icon: List },
]

interface Props {
  route: Route
  onNavigate: (r: Route) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  onOpenSearch: () => void
  mode: AiMode
  setMode: (m: AiMode) => void
  liveAvailable: boolean
  openBySite: Record<Building, number>
  onSiteClick: (b: Building) => void
}

export function Sidebar(props: Props) {
  return (
    <>
      {/* Desktop: fixed rail that collapses to icons */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-line bg-surface/70 backdrop-blur-xl transition-[width] duration-300 ${
          props.collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <SidebarBody {...props} collapsed={props.collapsed} />
      </aside>

      {/* Mobile: slide-in drawer */}
      <AnimatePresence>
        {props.mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={props.onCloseMobile}
            />
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

function SidebarBody({
  route,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  onCloseMobile,
  onOpenSearch,
  mode,
  setMode,
  liveAvailable,
  openBySite,
  onSiteClick,
  mobile,
}: Props & { mobile?: boolean }) {
  const go = (r: Route) => {
    onNavigate(r)
    onCloseMobile()
  }
  const totalOpen = Object.values(openBySite).reduce((a, b) => a + b, 0)

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={`flex items-center gap-3 h-[76px] shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
        <div className="size-10 shrink-0 rounded-xl bg-gradient-to-br from-ember to-[#c2410c] grid place-items-center shadow-lg shadow-ember/30">
          <Flame className="size-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-tight leading-none">Ember Sync</div>
            <div className="text-[11px] text-muted mt-1">Fire alarm intelligence</div>
          </div>
        )}
      </div>

      <nav className="px-3 space-y-1" aria-label="Main">
        {NAV.map((n) => (
          <NavItem
            key={n.id}
            icon={n.icon}
            label={n.label}
            active={route === n.id}
            collapsed={collapsed}
            badge={n.id === 'events' && totalOpen > 0 ? totalOpen : undefined}
            onClick={() => go(n.id)}
          />
        ))}
        <NavItem
          icon={Sparkles}
          label="Ask AI"
          collapsed={collapsed}
          kbd="⌘K"
          ai
          onClick={() => {
            onCloseMobile()
            onOpenSearch()
          }}
        />
      </nav>

      {/* Site status */}
      <div className={`mt-6 px-3 ${collapsed ? 'hidden' : ''}`}>
        <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-muted">Sites</div>
        <ul className="space-y-0.5">
          {BUILDINGS.map((b) => (
            <li key={b}>
              <button
                onClick={() => {
                  onSiteClick(b)
                  onCloseMobile()
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-left hover:bg-white/5 group"
                title={`Filter by ${b}`}
              >
                <span className={`size-2 rounded-full shrink-0 ${openBySite[b] ? 'bg-sev-critical animate-pulse' : 'bg-[#0ca30c]'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-ink-2 group-hover:text-ink truncate">{b}</span>
                  <span className="block text-[10px] text-muted">
                    {SITES[b].city}
                    {openBySite[b] ? ` · ${openBySite[b]} open` : ' · all clear'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto p-3 space-y-2">
        {/* AI mode */}
        {!collapsed ? (
          <div className="rounded-xl border border-line bg-bg/40 p-1 flex" role="radiogroup" aria-label="AI mode">
            {(['live', 'demo'] as const).map((m) => {
              const disabled = m === 'live' && !liveAvailable
              return (
                <button
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  disabled={disabled}
                  onClick={() => setMode(m)}
                  title={disabled ? 'Add ANTHROPIC_API_KEY to .env.local to enable live Claude' : undefined}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    mode === m ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink-2'
                  }`}
                >
                  {m === 'live' && <Sparkles className="size-3 text-ember-2" />}
                  {m === 'live' ? 'Live Claude' : 'Demo'}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex justify-center" title={`AI mode: ${mode === 'live' ? 'Live Claude' : 'Demo'}`}>
            <span className={`size-2 rounded-full ${mode === 'live' ? 'bg-[#0ca30c]' : 'bg-muted'}`} />
          </div>
        )}

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

function NavItem({
  icon: Icon,
  label,
  active,
  collapsed,
  badge,
  kbd,
  ai,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  collapsed: boolean
  badge?: number
  kbd?: string
  ai?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`relative w-full flex items-center gap-3 rounded-lg h-10 text-sm transition-colors ${collapsed ? 'justify-center' : 'px-3'} ${
        active ? 'bg-white/[0.07] text-ink' : 'text-ink-2 hover:bg-white/5 hover:text-ink'
      }`}
    >
      {active && <motion.span layoutId="nav-active" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-ember" />}
      <Icon className={`size-[18px] shrink-0 ${ai ? 'text-ember-2' : active ? 'text-ember' : ''}`} />
      {!collapsed && <span className={`flex-1 text-left ${ai ? 'ai-text font-medium' : ''}`}>{label}</span>}
      {!collapsed && badge != null && (
        <span className="rounded-full bg-sev-critical/20 text-[#ff8a8d] px-1.5 text-[10px] font-semibold tabular">{badge}</span>
      )}
      {!collapsed && kbd && <kbd className="rounded border border-line px-1 text-[10px] text-muted">{kbd}</kbd>}
      {collapsed && badge != null && <span className="absolute top-1.5 right-3 size-2 rounded-full bg-sev-critical" />}
    </button>
  )
}

export function MobileTopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
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
        <span className="font-semibold text-sm">Ember Sync</span>
      </div>
      <button onClick={onSearch} className="p-2 rounded-md text-ink-2 hover:bg-white/5" aria-label="Ask AI">
        <Search className="size-5" />
      </button>
    </div>
  )
}
