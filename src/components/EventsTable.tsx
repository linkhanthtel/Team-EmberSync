import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fmtDuration } from '../lib/analytics.ts'
import { SEV_COLOR, dateTime } from '../lib/theme.ts'
import type { AlarmEvent, Severity, Status } from '../lib/types.ts'

const PAGE = 10

export function SeverityBadge({ s }: { s: Severity }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-white/5 text-ink-2">
      <span className="size-1.5 rounded-full" style={{ background: SEV_COLOR[s] }} />
      {s}
    </span>
  )
}

export function StatusBadge({ s }: { s: Status }) {
  const cls =
    s === 'Active'
      ? 'bg-sev-critical/15 text-[#ff8a8d] ring-1 ring-sev-critical/30'
      : s === 'Acknowledged'
        ? 'bg-sev-medium/10 text-sev-medium'
        : 'bg-white/5 text-muted'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {s === 'Active' && <span className="size-1.5 rounded-full bg-sev-critical animate-pulse" />}
      {s}
    </span>
  )
}

export function EventsTable({ events }: { events: AlarmEvent[] }) {
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => setPage(0), [events])
  const pages = Math.max(1, Math.ceil(events.length / PAGE))
  const rows = events.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-sm font-semibold">Event log</h3>
          <p className="text-xs text-muted mt-0.5">{events.length} matching events · click a row for details</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="tabular">
            {page + 1} / {pages}
          </span>
          <button className="p-1.5 rounded-md hover:bg-white/5 disabled:opacity-30" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          <button className="p-1.5 rounded-md hover:bg-white/5 disabled:opacity-30" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
              {['Event', 'Time (UTC)', 'Location', 'Type', 'Severity', 'Status', 'Response'].map((h) => (
                <th key={h} className="px-5 py-2.5 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <FragmentRow key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-muted">
                  No events match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FragmentRow({ e, open, onToggle }: { e: AlarmEvent; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className="border-t border-line hover:bg-white/[0.025] cursor-pointer">
        <td className="px-5 py-3 font-mono text-xs text-ink-2 whitespace-nowrap">{e.id}</td>
        <td className="px-5 py-3 tabular text-ink-2 whitespace-nowrap">{dateTime(e.timestamp)}</td>
        <td className="px-5 py-3 whitespace-nowrap">
          <div className="text-ink">{e.building}</div>
          <div className="text-xs text-muted">
            Floor {e.floor} · {e.zone}
          </div>
        </td>
        <td className="px-5 py-3 whitespace-nowrap text-ink-2">{e.type}</td>
        <td className="px-5 py-3">
          <SeverityBadge s={e.severity} />
        </td>
        <td className="px-5 py-3">
          <StatusBadge s={e.status} />
        </td>
        <td className="px-5 py-3 tabular text-ink-2 whitespace-nowrap">{e.responseTimeSec != null ? fmtDuration(e.responseTimeSec) : '—'}</td>
      </tr>
      {open && (
        <tr className="bg-white/[0.02]">
          <td colSpan={7} className="px-5 pb-4 pt-1">
            <div className="grid sm:grid-cols-4 gap-4 text-xs">
              <Detail label="Device" value={`${e.deviceType} · ${e.deviceId}`} />
              <Detail label="Responder" value={e.acknowledgedBy ?? 'Unassigned'} />
              <div className="sm:col-span-2">
                <Detail label="Notes" value={e.notes} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-muted mb-0.5">{label}</div>
    <div className="text-ink-2">{value}</div>
  </div>
)
