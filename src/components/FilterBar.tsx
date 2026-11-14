import { Sparkles, X } from 'lucide-react'
import { fmtDuration } from '../lib/analytics.ts'
import { SEV_COLOR } from '../lib/theme.ts'
import { ALARM_TYPES, BUILDINGS, EMPTY_FILTERS, SEVERITIES, type Filters } from '../lib/types.ts'

type Chip = { label: string; clear: (f: Filters) => Filters }

/** Human-readable chips for every active filter (used by the bar and the AI search preview). */
export function describeFilters(f: Filters): Chip[] {
  const chips: Chip[] = []
  if (f.buildings.length) chips.push({ label: f.buildings.join(', '), clear: (x) => ({ ...x, buildings: [] }) })
  if (f.types.length) chips.push({ label: f.types.join(', '), clear: (x) => ({ ...x, types: [] }) })
  if (f.severities.length) chips.push({ label: f.severities.join(', '), clear: (x) => ({ ...x, severities: [] }) })
  if (f.statuses.length) chips.push({ label: f.statuses.join(', '), clear: (x) => ({ ...x, statuses: [] }) })
  if (f.floors.length) chips.push({ label: `Floor ${f.floors.join(', ')}`, clear: (x) => ({ ...x, floors: [] }) })
  if (f.dateFrom || f.dateTo)
    chips.push({ label: `${f.dateFrom ?? 'start'} → ${f.dateTo ?? 'today'}`, clear: (x) => ({ ...x, dateFrom: null, dateTo: null }) })
  if (f.hourFrom != null && f.hourTo != null)
    chips.push({
      label: `${String(f.hourFrom).padStart(2, '0')}:00–${String(f.hourTo).padStart(2, '0')}:59 UTC`,
      clear: (x) => ({ ...x, hourFrom: null, hourTo: null }),
    })
  if (f.minResponseSec != null) chips.push({ label: `Response ≥ ${fmtDuration(f.minResponseSec)}`, clear: (x) => ({ ...x, minResponseSec: null }) })
  if (f.text) chips.push({ label: `“${f.text}”`, clear: (x) => ({ ...x, text: null }) })
  if (f.sortBy !== 'newest') chips.push({ label: f.sortBy === 'oldest' ? 'Oldest first' : 'Slowest response first', clear: (x) => ({ ...x, sortBy: 'newest' }) })
  return chips
}

const PRESETS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: null },
] as const

const addDays = (s: string, n: number) => {
  const d = new Date(s + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const selectCls =
  'h-9 rounded-lg border border-line bg-surface px-3 pr-8 text-sm text-ink-2 hover:border-white/20 focus:border-ember/60 outline-none appearance-none bg-no-repeat bg-[right_0.6rem_center] bg-[length:12px] ' +
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a8983' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]"

export function FilterBar({
  filters,
  setFilters,
  today,
  aiInterpretation,
  onClearAi,
}: {
  filters: Filters
  setFilters: (f: Filters) => void
  today: string
  aiInterpretation: string | null
  onClearAi: () => void
}) {
  const presetActive = (days: number | null) =>
    !filters.dateTo && (days == null ? !filters.dateFrom : filters.dateFrom === addDays(today, -days + 1))
  // Chips for filters the dropdowns don't cover (AI search can set any of them).
  const extraChips = describeFilters({ ...filters, buildings: filters.buildings.length > 1 ? filters.buildings : [], types: filters.types.length > 1 ? filters.types : [], severities: [], dateFrom: presetActive(7) || presetActive(30) ? null : filters.dateFrom, dateTo: filters.dateTo })
  const anyActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <div className="space-y-3">
      {aiInterpretation && (
        <div className="ai-ring flex items-center gap-2.5 rounded-xl bg-surface px-4 py-2.5 text-sm">
          <Sparkles className="size-4 text-ember-2 shrink-0" />
          <span className="text-ink-2 flex-1">{aiInterpretation}</span>
          <button onClick={onClearAi} className="text-xs text-muted hover:text-ink inline-flex items-center gap-1">
            <X className="size-3.5" /> Clear AI filter
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 rounded-lg border border-line bg-surface p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setFilters({ ...filters, dateFrom: p.days ? addDays(today, -p.days + 1) : null, dateTo: null })}
              className={`px-3 rounded-md text-xs font-medium transition-colors ${presetActive(p.days) ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink-2'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Building"
          className={selectCls}
          value={filters.buildings.length === 1 ? filters.buildings[0] : ''}
          onChange={(e) => setFilters({ ...filters, buildings: e.target.value ? [e.target.value as (typeof BUILDINGS)[number]] : [] })}
        >
          <option value="">{filters.buildings.length > 1 ? 'Multiple buildings' : 'All buildings'}</option>
          {BUILDINGS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>

        <select
          aria-label="Alarm type"
          className={selectCls}
          value={filters.types.length === 1 ? filters.types[0] : ''}
          onChange={(e) => setFilters({ ...filters, types: e.target.value ? [e.target.value as (typeof ALARM_TYPES)[number]] : [] })}
        >
          <option value="">{filters.types.length > 1 ? 'Multiple types' : 'All types'}</option>
          {ALARM_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {SEVERITIES.map((s) => {
            const on = filters.severities.includes(s)
            return (
              <button
                key={s}
                aria-pressed={on}
                onClick={() => setFilters({ ...filters, severities: on ? filters.severities.filter((x) => x !== s) : [...filters.severities, s] })}
                className={`h-9 inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors ${on ? 'border-white/25 bg-white/10 text-ink' : 'border-line bg-surface text-muted hover:text-ink-2'}`}
              >
                <span className="size-2 rounded-full" style={{ background: SEV_COLOR[s] }} />
                {s}
              </button>
            )
          })}
        </div>

        {extraChips.map((c) => (
          <span key={c.label} className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-ai/30 bg-ai/10 pl-3 pr-2 text-xs text-ink-2">
            {c.label}
            <button onClick={() => setFilters(c.clear(filters))} className="text-muted hover:text-ink" aria-label={`Remove ${c.label}`}>
              <X className="size-3.5" />
            </button>
          </span>
        ))}

        {anyActive && (
          <button onClick={() => (setFilters(EMPTY_FILTERS), onClearAi())} className="ml-auto text-xs text-muted hover:text-ink">
            Reset all
          </button>
        )}
      </div>
    </div>
  )
}
