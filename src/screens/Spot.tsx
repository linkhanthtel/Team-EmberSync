import { useMemo } from 'react'
import { BcMap } from '../components/BcMap.tsx'
import { ChartCard } from '../components/charts.tsx'
import { Note, useLoaded } from '../components/ui.tsx'
import { CALENDAR, FIRE_CENTRES, FIRMS, loadCentres, shortCentre, ymLabel, type CentreSel, type FireCentre } from '../lib/fire.ts'
import { CENTRE_COLOR, fmtInt } from '../lib/theme.ts'

export function Spot({ centre, onCentre }: { centre: CentreSel; onCentre: (c: CentreSel) => void }) {
  const [centres, err] = useLoaded(loadCentres)

  const rows = useMemo(() => {
    const total = FIRMS.total.count
    return FIRE_CENTRES.map((c) => {
      const cal = CALENDAR.filter((r) => r.centre === c)
      const peak = cal.reduce((a, b) => (b.count > a.count ? b : a))
      const raw = FIRMS.byCentre[c]
      return { c, raw: raw.count, share: raw.count / total, harmonised: cal.reduce((s, r) => s + r.count, 0), peak, lowConf: raw.lowConf / raw.count }
    }).sort((a, b) => b.raw - a.raw)
  }, [])

  const value = (c: FireCentre) => {
    const r = rows.find((x) => x.c === c)!
    return `${fmtInt(r.raw)} detections · ${(r.share * 100).toFixed(1)}% of BC`
  }

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3">
          <ChartCard title="BC Wildfire Service fire centres" subtitle="Click a centre to focus it; the choice carries to every move">
            {err ? <p className="text-sm text-[#ff8a8d]">{err}</p> : <BcMap variant="spot" centres={centres} centre={centre} onSelectCentre={onCentre} centreValue={value} />}
          </ChartCard>
        </div>
        <div className="xl:col-span-2">
          <ChartCard title="Where BC burns" subtitle="Cleaned detections 2001–2025 and the busiest harmonised month">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted text-left">
                  <tr className="border-b border-line">
                    <th className="py-2 font-normal">Fire centre</th>
                    <th className="py-2 font-normal text-right">Detections</th>
                    <th className="py-2 font-normal text-right">Share</th>
                    <th className="py-2 font-normal text-right">Peak month</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.c}
                      onClick={() => onCentre(centre === r.c ? null : r.c)}
                      className={`border-b border-line/60 cursor-pointer hover:bg-white/[0.03] ${centre === r.c ? 'bg-white/[0.05]' : ''}`}
                    >
                      <td className="py-2.5">
                        <span className="flex items-center gap-2 text-ink-2">
                          <span className="size-2.5 rounded-sm shrink-0" style={{ background: CENTRE_COLOR[r.c] }} />
                          {shortCentre(r.c)}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular text-ink">{fmtInt(r.raw)}</td>
                      <td className="py-2.5 text-right tabular text-ink-2">{(r.share * 100).toFixed(1)}%</td>
                      <td className="py-2.5 text-right tabular text-ink-2 whitespace-nowrap">
                        {ymLabel(r.peak.ym)} <span className="text-muted">· {fmtInt(r.peak.count)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted mt-3">Peak month uses harmonised hotspot counts (VIIRS scale).</p>
          </ChartCard>
        </div>
      </div>

      <Note>
        <p>
          <strong>How we spotted BC.</strong> From the Canada archive we picked British Columbia as a fire-prone territory whose fire service already plans by
          region. The BC Wildfire Service runs six fire centres, so we use them as our unit: every detection is tagged with its centre by a spatial join
          to the official boundaries (field <code className="text-ink">MOF_FIRE_CENTRE_NAME</code>), simplified for the web map.
        </p>
        <p>Pick a centre here or in the sidebar. Block, Watch and Make the call all follow that choice.</p>
      </Note>
    </>
  )
}
