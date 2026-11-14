import { ArrowUpRight, MapPin } from 'lucide-react'
import { countBy, fmtDuration } from '../lib/analytics.ts'
import { SITES } from '../lib/sites.ts'
import { SEV_COLOR, dateTime } from '../lib/theme.ts'
import { SEVERITIES, type AlarmEvent, type Building } from '../lib/types.ts'
import type { SiteStats } from './WorldMap.tsx'

export function SiteCards({
  stats,
  events,
  selected,
  onSelect,
  onViewEvents,
}: {
  stats: SiteStats[]
  events: AlarmEvent[]
  selected: Building[]
  onSelect: (b: Building) => void
  onViewEvents: (b: Building) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
      {stats.map((s) => {
        const site = SITES[s.building]
        const sev = countBy(events.filter((e) => e.building === s.building), (e) => e.severity, SEVERITIES)
        const isSel = selected.includes(s.building)
        return (
          <div
            key={s.building}
            className={`card p-4 flex flex-col gap-3 transition-colors cursor-pointer hover:border-white/20 ${isSel ? 'border-ember/60!' : ''}`}
            onClick={() => onSelect(s.building)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{s.building}</div>
                <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                  <MapPin className="size-3" /> {site.city === site.country ? site.city : `${site.city}, ${site.country}`}
                </div>
              </div>
              {s.open > 0 ? (
                <span className="shrink-0 rounded-full bg-sev-critical/15 text-[#ff8a8d] px-2 py-0.5 text-[10px] font-semibold">{s.open} open</span>
              ) : (
                <span className="shrink-0 rounded-full bg-white/5 text-muted px-2 py-0.5 text-[10px]">All clear</span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Events" value={s.total} />
              <Metric label="Critical" value={s.critical} />
              <Metric label="Avg resp." value={s.avgResponse ? fmtDuration(s.avgResponse) : '—'} />
            </div>

            {/* Severity mix with labels in the tooltip + legend below */}
            <div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-2 gap-px">
                {sev.filter((d) => d.value).map((d) => (
                  <div key={d.name} title={`${d.name}: ${d.value}`} style={{ flex: d.value, background: SEV_COLOR[d.name] }} />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-muted tabular">
                {sev.map((d) => (
                  <span key={d.name}>
                    {d.name[0]}:{d.value}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-muted border-t border-line pt-2.5 flex items-center justify-between gap-2">
              <span className="truncate">{s.latest ? `Last: ${s.latest.type} · ${dateTime(s.latest.timestamp)}` : 'No events'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onViewEvents(s.building)
                }}
                className="shrink-0 inline-flex items-center gap-0.5 text-ember-2 hover:underline"
              >
                Events <ArrowUpRight className="size-3" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg bg-white/[0.03] py-2">
    <div className="text-sm font-semibold tabular">{value}</div>
    <div className="text-[10px] text-muted">{label}</div>
  </div>
)
