import { Download, Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ChartCard } from '../components/charts.tsx'
import { Segmented, selectCls, useLoaded } from '../components/ui.tsx'
import { YEARS, loadWatchList, shortCentre, ymLabel, type CentreSel } from '../lib/fire.ts'
import { HAS_REVIEWED, buildInsights, insightsCsv } from '../lib/insights.ts'
import { CENTRE_COLOR } from '../lib/theme.ts'

type Show = 'notable' | 'all'
type Sort = 'count' | 'date'
const PAGE = 50

export function Call({ centre, onOpenMonth }: { centre: CentreSel; onOpenMonth: (ym: string) => void }) {
  const [watch] = useLoaded(loadWatchList)
  const [year, setYear] = useState<number | null>(null)
  const [show, setShow] = useState<Show>('notable')
  const [sort, setSort] = useState<Sort>('count')
  const [limit, setLimit] = useState(PAGE)

  const all = useMemo(() => buildInsights(watch), [watch])
  const rows = useMemo(() => {
    const r = all.filter(
      (i) => (!centre || i.centre === centre) && (year == null || i.ym.startsWith(String(year))) && (show === 'all' || (i.ratio != null && i.ratio >= 1.5 && i.count >= 10)),
    )
    return sort === 'count' ? r.sort((a, b) => b.count - a.count) : r.sort((a, b) => b.ym.localeCompare(a.ym) || a.centre.localeCompare(b.centre))
  }, [all, centre, year, show, sort])

  const download = () => {
    const blob = new Blob([insightsCsv(rows)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `embersync_insights_${centre ? shortCentre(centre).toLowerCase().replace(/\s+/g, '_') : 'bc'}${year ? `_${year}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      {!HAS_REVIEWED && (
        <div className="flex gap-3 rounded-xl border border-sev-medium/30 bg-sev-medium/10 px-4 py-3 text-xs text-ink-2 leading-relaxed">
          <Info className="size-4 shrink-0 text-sev-medium mt-0.5" />
          <p>
            <strong className="text-ink">Draft insights.</strong> The team-reviewed Gemini insights file is not in <code>src/data/</code> yet, so these sentences are built
            from the calendar with the same rules (one sentence, ≤ 25 words, data numbers only, sensor and dates named, one watch-list area). Drop a CSV named{' '}
            <code>*insights*.csv</code> with columns <code>fire_centre, ym, insight</code> into <code>src/data/</code> and it replaces the drafts.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Year" className={selectCls} value={year ?? ''} onChange={(e) => (setYear(e.target.value ? Number(e.target.value) : null), setLimit(PAGE))}>
          <option value="">All years</option>
          {[...YEARS].reverse().map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <Segmented
          ariaLabel="Show"
          options={['notable', 'all'] as const}
          value={show}
          onChange={(v) => (setShow(v), setLimit(PAGE))}
          label={(v) => (v === 'notable' ? 'Above normal' : 'All months')}
        />
        <Segmented ariaLabel="Sort" options={['count', 'date'] as const} value={sort} onChange={setSort} label={(v) => (v === 'count' ? 'Most hotspots' : 'Newest')} />
        <span className="text-xs text-muted ml-1 tabular">{rows.length.toLocaleString()} insights</span>
        <button
          onClick={download}
          disabled={!rows.length}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-ember to-ember-2 px-3.5 h-8 text-xs font-medium text-black shadow-lg shadow-ember/20 hover:brightness-110 disabled:opacity-40"
        >
          <Download className="size-3.5" /> Download insights CSV
        </button>
      </div>

      <ChartCard
        title={`${centre ? shortCentre(centre) : 'All fire centres'} · one line per month`}
        subtitle={show === 'notable' ? 'Months at 1.5× or more of the 2001–2025 mean for that calendar month (and ≥ 10 hotspots)' : 'Every fire-centre month'}
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No months match.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.slice(0, limit).map((i) => (
              <li key={`${i.centre}|${i.ym}`} className="py-3 flex gap-3 items-start">
                <span className="mt-1.5 size-2.5 rounded-sm shrink-0" style={{ background: CENTRE_COLOR[i.centre] }} />
                <p className="flex-1 text-sm text-ink-2 leading-relaxed">{i.text}</p>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <button onClick={() => onOpenMonth(i.ym)} className="text-xs text-ember-2 hover:underline whitespace-nowrap">
                    {ymLabel(i.ym)} on map →
                  </button>
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${i.source === 'reviewed' ? 'bg-[#0ca30c]/15 text-[#5fd35f]' : 'bg-white/5 text-muted'}`}>
                    {i.source === 'reviewed' ? 'team reviewed' : 'draft'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {rows.length > limit && (
          <button onClick={() => setLimit((l) => l + PAGE)} className="mt-3 w-full rounded-lg border border-line py-2 text-xs text-ink-2 hover:bg-white/5">
            Show more ({(rows.length - limit).toLocaleString()} left)
          </button>
        )}
        {!watch && <p className="text-[11px] text-muted mt-3">Loading the watch list to add watch areas…</p>}
      </ChartCard>
    </>
  )
}
