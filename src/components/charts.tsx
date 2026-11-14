import { useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import {
  FIRE_CENTRES,
  METRIC_LABEL,
  MONTHS,
  SENSOR_LABEL,
  VIIRS_FROM,
  YEARS,
  calendarCell,
  metricOf,
  shortCentre,
  ym,
  ymLabel,
  type CentreSel,
  type FireCentre,
  type Metric,
  type Sensor,
} from '../lib/fire.ts'
import { CENTRE_COLOR, CHART, SENSOR_COLOR, fmtCompact, fmtInt, fmtMW, heat, logScale } from '../lib/theme.ts'

type TipProps = TooltipContentProps<number | string | readonly (number | string)[], string | number>

export function ChartCard({ title, subtitle, children, right }: { title: string; subtitle?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card p-5 flex flex-col min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  )
}

const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.muted, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

export function TipShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/95 backdrop-blur px-3 py-2 text-xs shadow-xl shadow-black/40 min-w-40">
      <div className="text-ink-2 mb-1.5 font-medium">{title}</div>
      {children}
    </div>
  )
}

export function TipRow({ color, label, value }: { color?: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {color && <span className="size-2 rounded-sm" style={{ background: color }} />}
      <span className="text-muted flex-1">{label}</span>
      <span className="text-ink tabular font-medium">{value}</span>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; muted?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
      {items.map((i) => (
        <span key={i.label} className={`flex items-center gap-1.5 text-xs ${i.muted ? 'text-muted' : 'text-ink-2'}`}>
          <span className="size-2.5 rounded-sm" style={{ background: i.color, opacity: i.muted ? 0.35 : 1 }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

export const fmtMetric = (m: Metric, v: number) => (m === 'count' ? fmtInt(v) : fmtMW(v))

/* ---------- The fire calendar: year × month, harmonised ---------- */
export function FireCalendar({
  centre,
  metric,
  selected,
  onSelect,
}: {
  centre: CentreSel
  metric: Metric
  selected: string | null
  onSelect: (ym: string) => void
}) {
  const rows = useMemo(
    () => YEARS.map((y) => ({ year: y, cells: MONTHS.map((_, i) => calendarCell(centre, ym(y, i + 1))) })),
    [centre],
  )
  const max = useMemo(() => Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => metricOf(c, metric)))), [rows, metric])
  const yearMax = useMemo(() => Math.max(1, ...rows.map((r) => r.cells.reduce((s, c) => s + metricOf(c, metric), 0))), [rows, metric])
  const [hover, setHover] = useState<string | null>(null)
  const focus = hover ?? selected
  const fc = focus ? calendarCell(centre, focus) : null

  return (
    <div>
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="grid gap-[3px] min-w-[560px]" style={{ gridTemplateColumns: '44px repeat(12, minmax(0, 1fr)) 72px' }}>
          <div />
          {MONTHS.map((m) => (
            <div key={m} className="text-[10px] text-muted text-center pb-1">
              {m}
            </div>
          ))}
          <div className="text-[10px] text-muted text-right pb-1">Year</div>
          {rows.map((r) => {
            const total = r.cells.reduce((s, c) => s + metricOf(c, metric), 0)
            return (
              <div key={r.year} className="contents">
                <div
                  className={`text-[10px] tabular self-center pr-1 flex items-center gap-1 ${r.year === VIIRS_FROM ? 'text-ink-2' : 'text-muted'}`}
                  title={r.year < VIIRS_FROM ? 'MODIS × factor' : 'VIIRS S-NPP as observed'}
                >
                  <span className="size-1.5 rounded-full shrink-0" style={{ background: r.year < VIIRS_FROM ? SENSOR_COLOR.MODIS : SENSOR_COLOR.VIIRS_SNPP }} />
                  {r.year}
                </div>
                {r.cells.map((c) => {
                  const v = metricOf(c, metric)
                  const isSel = c.ym === selected
                  return (
                    <button
                      key={c.ym}
                      onMouseEnter={() => setHover(c.ym)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(c.ym)}
                      onBlur={() => setHover(null)}
                      onClick={() => onSelect(c.ym)}
                      aria-label={`${ymLabel(c.ym)}: ${fmtMetric(metric, v)}`}
                      aria-pressed={isSel}
                      className={`h-[18px] rounded-[3px] transition-transform hover:scale-110 hover:z-10 focus-visible:outline-2 focus-visible:outline-white ${
                        isSel ? 'ring-2 ring-white z-10' : ''
                      } ${r.year === VIIRS_FROM ? 'mt-1' : ''}`}
                      style={{ background: heat(logScale(v, max, metric === 'count' ? 10 : 100)) }}
                    />
                  )
                })}
                <div className={`flex items-center gap-1.5 pl-1 ${r.year === VIIRS_FROM ? 'mt-1' : ''}`}>
                  <div className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(total / yearMax) * 100}%`, background: CHART.ember }} />
                  </div>
                  <span className="text-[10px] text-muted tabular w-8 text-right">{fmtCompact(total)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-[11px] text-muted">
        <span className="min-h-4">
          {fc ? (
            <>
              <span className="text-ink-2 font-medium">{ymLabel(fc.ym)}</span> · <span className="text-ink tabular font-medium">{fmtMetric(metric, metricOf(fc, metric))}</span>{' '}
              {METRIC_LABEL[metric].toLowerCase()} ·{' '}
              {fc.year < VIIRS_FROM ? `MODIS ${fmtInt(metric === 'count' ? fc.countModis : fc.energyModis)} × factor` : 'VIIRS as observed'}
            </>
          ) : (
            'Hover a month for values · click to open it on the map'
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: SENSOR_COLOR.MODIS }} /> 2001–2011 MODIS × factor
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: SENSOR_COLOR.VIIRS_SNPP }} /> 2012–2025 VIIRS
          </span>
          <span className="flex items-center gap-1.5">
            0
            <span className="h-2 w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${heat(0.01)}, ${heat(0.5)}, ${heat(1)})` }} />
            {fmtCompact(max)} <span className="opacity-70">(log)</span>
          </span>
        </span>
      </div>
    </div>
  )
}

/* ---------- Annual totals stacked by fire centre ---------- */
export function AnnualByCentre({ metric, centre }: { metric: Metric; centre: CentreSel }) {
  const shown: FireCentre[] = centre ? [centre] : [...FIRE_CENTRES]
  const data = useMemo(
    () =>
      YEARS.map((y) => {
        const row: Record<string, number> = { year: y }
        for (const c of FIRE_CENTRES) row[c] = MONTHS.reduce((s, _, i) => s + metricOf(calendarCell(c, ym(y, i + 1)), metric), 0)
        return row
      }),
    [metric],
  )
  const Tip = ({ active, payload, label }: TipProps) => {
    if (!active || !payload?.length) return null
    const total = payload.reduce((s, p) => s + Number(p.value ?? 0), 0)
    return (
      <TipShell title={`${label} · ${fmtMetric(metric, total)}`}>
        {[...payload].reverse().map((p) => (
          <TipRow key={String(p.dataKey)} color={String(p.color)} label={shortCentre(p.dataKey as FireCentre)} value={fmtMetric(metric, Number(p.value))} />
        ))}
      </TipShell>
    )
  }
  return (
    <div>
      <Legend items={FIRE_CENTRES.map((c) => ({ label: shortCentre(c), color: CENTRE_COLOR[c], muted: !shown.includes(c) }))} />
      <div className="h-60">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="year" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} tickFormatter={fmtCompact} width={44} />
            <Tooltip content={Tip} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
            {shown.map((c, i) => (
              <Bar key={c} dataKey={c} stackId="a" fill={CENTRE_COLOR[c]} stroke={CHART.surface} strokeWidth={1} radius={i === shown.length - 1 ? [3, 3, 0, 0] : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ---------- Raw detections per sensor per year (Scan) ---------- */
export function SensorYears({ data }: { data: Record<Sensor, { year: number; count: number }[]> }) {
  const rows = useMemo(
    () => YEARS.map((y) => ({ year: y, MODIS: data.MODIS.find((d) => d.year === y)?.count ?? 0, VIIRS_SNPP: data.VIIRS_SNPP.find((d) => d.year === y)?.count ?? 0 })),
    [data],
  )
  const Tip = ({ active, payload, label }: TipProps) =>
    active && payload?.length ? (
      <TipShell title={String(label)}>
        {payload.map((p) => (
          <TipRow key={String(p.dataKey)} color={String(p.color)} label={SENSOR_LABEL[p.dataKey as Sensor]} value={fmtInt(Number(p.value))} />
        ))}
      </TipShell>
    ) : null
  return (
    <div>
      <Legend items={(['MODIS', 'VIIRS_SNPP'] as Sensor[]).map((s) => ({ label: SENSOR_LABEL[s], color: SENSOR_COLOR[s] }))} />
      <div className="h-60">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={1} barCategoryGap={3}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="year" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} tickFormatter={fmtCompact} width={44} />
            <Tooltip content={Tip} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
            {(['MODIS', 'VIIRS_SNPP'] as Sensor[]).map((s) => (
              <Bar key={s} dataKey={s} fill={SENSOR_COLOR[s]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ---------- MODIS vs VIIRS overlap fit (Block validation) ---------- */
export function FactorScatter({
  points,
  k,
  r,
  label,
  unit,
}: {
  points: { centre: FireCentre; ym: string; x: number; y: number }[]
  k: number
  r: number
  label: string
  unit: (v: number) => string
}) {
  const xmax = Math.max(1, ...points.map((p) => p.x))
  const line = [
    { x: 0, y: 0 },
    { x: xmax, y: k * xmax },
  ]
  const Tip = ({ active, payload }: TipProps) => {
    const p = active && payload?.[0]?.payload
    if (!p || !('centre' in p)) return null
    return (
      <TipShell title={`${shortCentre(p.centre)} · ${ymLabel(p.ym)}`}>
        <TipRow color={SENSOR_COLOR.MODIS} label="MODIS" value={unit(p.x)} />
        <TipRow color={SENSOR_COLOR.VIIRS_SNPP} label="VIIRS" value={unit(p.y)} />
        <TipRow label={`MODIS × ${k.toFixed(2)}`} value={unit(p.x * k)} />
      </TipShell>
    )
  }
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs mb-2">
        <span className="text-muted">
          {label} factor <span className="text-ink text-base font-semibold tabular">{k.toFixed(2)}</span>
        </span>
        <span className="text-muted">
          fit r <span className="text-ink tabular font-medium">{r.toFixed(3)}</span>
        </span>
        <span className="text-muted">n = {points.length} centre-months</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} />
            <XAxis type="number" dataKey="x" domain={[0, 'dataMax']} {...axisProps} tickFormatter={fmtCompact} />
            <YAxis type="number" dataKey="y" {...axisProps} tickFormatter={fmtCompact} width={44} />
            <Tooltip content={Tip} cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }} />
            <Scatter data={points} fill={SENSOR_COLOR.VIIRS_SNPP} fillOpacity={0.55} stroke={CHART.surface} strokeWidth={1} isAnimationActive={false} />
            <Scatter data={line} line={{ stroke: CHART.ember, strokeWidth: 2 }} shape={() => <g />} legendType="none" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted mt-1">
        x = MODIS, y = VIIRS for the same fire-centre month (2012–2025). Line: VIIRS = {k.toFixed(2)} × MODIS (least squares through the origin).
      </p>
    </div>
  )
}
