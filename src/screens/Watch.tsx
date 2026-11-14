import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { BcMap } from '../components/BcMap.tsx'
import { ChartCard, fmtMetric } from '../components/charts.tsx'
import { Segmented, selectCls, useLoaded } from '../components/ui.tsx'
import {
  METRIC_LABEL,
  MONTHS,
  SENSOR_LABEL,
  VIIRS_FROM,
  YEARS,
  calendarCell,
  calendarSensor,
  confidenceLabel,
  describeLandmark,
  placesToWatch,
  loadCentres,
  loadMonthCells,
  loadWatchList,
  shortCentre,
  ym as ymKey,
  ymLabel,
  type CentreSel,
  type Metric,
  type Sensor,
} from '../lib/fire.ts'
import { insightFor } from '../lib/insights.ts'
import { fmtInt } from '../lib/theme.ts'

type SensorSel = 'calendar' | Sensor

export function Watch({
  centre,
  onCentre,
  metric,
  onMetric,
  ym,
  onYm,
}: {
  centre: CentreSel
  onCentre: (c: CentreSel) => void
  metric: Metric
  onMetric: (m: Metric) => void
  ym: string
  onYm: (ym: string) => void
}) {
  const [centres, e1] = useLoaded(loadCentres)
  const [cellIdx, e2] = useLoaded(loadMonthCells)
  const [watchIdx, e3] = useLoaded(loadWatchList)
  const [sensorSel, setSensorSel] = useState<SensorSel>('calendar')
  const [showCells, setShowCells] = useState(true)
  const [showDots, setShowDots] = useState(true)
  const error = e1 ?? e2 ?? e3

  const year = Number(ym.slice(0, 4))
  const month = Number(ym.slice(5, 7))
  const sensor: Sensor = sensorSel === 'calendar' || year < VIIRS_FROM ? calendarSensor(year) : sensorSel

  const cells = useMemo(() => (cellIdx?.get(ym) ?? []).filter((c) => c.sensor === sensor), [cellIdx, ym, sensor])
  const dots = useMemo(() => (watchIdx?.get(ym) ?? []).filter((d) => d.sensor === sensor), [watchIdx, ym, sensor])
  const myCells = useMemo(
    () => cells.filter((c) => !centre || c.centre === centre).sort((a, b) => (metric === 'count' ? b.count - a.count : b.frp - a.frp)),
    [cells, centre, metric],
  )
  const myDots = useMemo(() => dots.filter((d) => !centre || d.centre === centre).sort((a, b) => b.frp - a.frp), [dots, centre])
  const places = useMemo(() => placesToWatch(myDots), [myDots])
  const cal = calendarCell(centre, ym)
  const insight = centre && watchIdx ? insightFor(centre, ym, watchIdx.get(ym)) : null

  const step = (d: number) => {
    const i = year * 12 + (month - 1) + d
    const y = Math.floor(i / 12)
    if (y < YEARS[0] || y > YEARS[YEARS.length - 1]) return
    onYm(ymKey(y, (i % 12) + 1))
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="size-8 grid place-items-center rounded-lg border border-line bg-surface text-ink-2 hover:text-ink" aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <select aria-label="Month" className={selectCls} value={month} onChange={(e) => onYm(ymKey(year, Number(e.target.value)))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select aria-label="Year" className={selectCls} value={year} onChange={(e) => onYm(ymKey(Number(e.target.value), month))}>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <button onClick={() => step(1)} className="size-8 grid place-items-center rounded-lg border border-line bg-surface text-ink-2 hover:text-ink" aria-label="Next month">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <Segmented
          ariaLabel="Sensor"
          options={['calendar', 'MODIS', 'VIIRS_SNPP'] as const}
          value={year < VIIRS_FROM ? 'calendar' : sensorSel}
          onChange={setSensorSel}
          label={(s) => (s === 'calendar' ? 'Calendar sensor' : SENSOR_LABEL[s])}
          disabled={(s) => year < VIIRS_FROM && s !== 'calendar'}
        />
        <Segmented ariaLabel="Colour by" options={['count', 'energy'] as const} value={metric} onChange={onMetric} label={(m) => METRIC_LABEL[m]} />
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-2 ml-1">
          <input type="checkbox" checked={showCells} onChange={(e) => setShowCells(e.target.checked)} className="accent-ember" /> Cells
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <input type="checkbox" checked={showDots} onChange={(e) => setShowDots(e.target.checked)} className="accent-ember" /> Lone dots
        </label>
      </div>

      {error && <p className="text-sm text-[#ff8a8d]">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3">
          <ChartCard
            title={`${centre ? shortCentre(centre) : 'All of BC'} · ${ymLabel(ym)}`}
            subtitle={`${SENSOR_LABEL[sensor]} · ${fmtInt(myCells.length)} active 0.1° cells · ${fmtInt(myDots.length)} lone dots`}
          >
            <BcMap
              centres={centres}
              centre={centre}
              onSelectCentre={onCentre}
              cells={showCells ? cells : []}
              dots={showDots ? dots : []}
              metric={metric}
              loading={!cellIdx || !watchIdx}
            />
          </ChartCard>
        </div>

        <div className="xl:col-span-2 space-y-5">
          <ChartCard title="This month in the calendar" subtitle={cal.year < VIIRS_FROM ? 'MODIS × factor' : 'VIIRS S-NPP as observed'}>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <Stat label="Harmonised hotspots" value={fmtInt(cal.count)} />
              <Stat label="Harmonised fire energy" value={fmtMetric('energy', cal.energy)} />
              <Stat label="MODIS hotspots" value={fmtInt(cal.countModis)} sub={`${fmtInt(cal.lowConfModis)} low conf.`} />
              <Stat label="VIIRS hotspots" value={year < VIIRS_FROM ? '—' : fmtInt(cal.countViirs)} sub={year < VIIRS_FROM ? 'before VIIRS' : `${fmtInt(cal.lowConfViirs)} low conf.`} />
            </dl>
            {insight && (
              <p className="mt-4 rounded-lg border border-line bg-bg/40 px-3 py-2.5 text-xs text-ink-2 leading-relaxed">
                <span className="text-[10px] uppercase tracking-wider text-ember-2 mr-1.5">{insight.source === 'reviewed' ? 'Insight' : 'Draft insight'}</span>
                {insight.text}
              </p>
            )}
          </ChartCard>

          <ChartCard title="Watch list" subtitle="Lone dots: the only detection in their 0.1° cell that day · highest FRP first">
            {myDots.length === 0 ? (
              <p className="text-xs text-muted">{watchIdx ? 'No lone dots this month.' : 'Loading…'}</p>
            ) : (
              <div className="max-h-80 overflow-y-auto -mx-1 px-1">
                <table className="w-full text-xs">
                  <thead className="text-muted text-left sticky top-0 bg-surface">
                    <tr className="border-b border-line">
                      <th className="py-1.5 font-normal">Date</th>
                      {!centre && <th className="py-1.5 font-normal">Centre</th>}
                      <th className="py-1.5 font-normal">Near</th>
                      <th className="py-1.5 font-normal text-right">FRP</th>
                      <th className="py-1.5 font-normal text-right">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myDots.slice(0, 200).map((d) => (
                      <tr key={d.id} className="border-b border-line/50">
                        <td className="py-1.5 tabular text-ink-2 whitespace-nowrap">{d.date.slice(5)}</td>
                        {!centre && <td className="py-1.5 text-ink-2">{shortCentre(d.centre)}</td>}
                        <td className="py-1.5 text-ink-2" title={`${d.lat.toFixed(3)}, ${d.lon.toFixed(3)} · ${describeLandmark(d.feature)} (${d.feature.type})`}>
                          {describeLandmark(d.place)}
                        </td>
                        <td className="py-1.5 tabular text-ink text-right">{d.frp.toFixed(1)}</td>
                        <td className={`py-1.5 tabular text-right ${d.lowConf ? 'text-ai' : 'text-ink-2'}`}>{confidenceLabel(d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {myDots.length > 200 && <p className="text-[11px] text-muted mt-2">Showing 200 of {fmtInt(myDots.length)}.</p>}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Places to watch" subtitle="Lone dots this month grouped by nearest place (GeoNames)">
            {places.length === 0 ? (
              <p className="text-xs text-muted">{watchIdx ? 'No lone dots this month.' : 'Loading…'}</p>
            ) : (
              <ul className="space-y-2">
                {places.slice(0, 6).map((p) => (
                  <li key={p.place}>
                    <div className="flex justify-between gap-2 text-xs mb-1">
                      <span className="text-ink-2 truncate">
                        {p.place} <span className="text-muted">· avg {p.km.toFixed(0)} km away{p.lowConf ? ` · ${p.lowConf} low conf.` : ''}</span>
                      </span>
                      <span className="tabular text-ink font-medium shrink-0">
                        {p.n} dot{p.n > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full bg-ink-2" style={{ width: `${(p.n / places[0].n) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>

          <ChartCard title="Hottest cells" subtitle={`Top 0.1° cells by ${metric === 'count' ? 'hotspots' : 'fire energy'} · raw ${SENSOR_LABEL[sensor]}`}>
            {myCells.length === 0 ? (
              <p className="text-xs text-muted">{cellIdx ? 'No active cells this month.' : 'Loading…'}</p>
            ) : (
              <ul className="space-y-2">
                {myCells.slice(0, 6).map((c) => {
                  const v = metric === 'count' ? c.count : c.frp
                  const max = metric === 'count' ? myCells[0].count : myCells[0].frp
                  return (
                    <li key={c.cellId}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ink-2 tabular">
                          {c.lat.toFixed(2)}°N {Math.abs(c.lon).toFixed(2)}°W {!centre && <span className="text-muted">· {shortCentre(c.centre)}</span>}
                        </span>
                        <span className="tabular text-ink font-medium">{fmtMetric(metric, v)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full rounded-full bg-ember" style={{ width: `${(v / max) * 100}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </ChartCard>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-bg/40 border border-line px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink text-base font-semibold tabular mt-0.5">{value}</dd>
      {sub && <dd className="text-[10px] text-muted">{sub}</dd>}
    </div>
  )
}
