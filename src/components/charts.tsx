import { useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
type TipProps = TooltipContentProps<number | string | readonly (number | string)[], string | number>
import { fmtDuration } from '../lib/analytics.ts'
import { CHART, SEV_COLOR, heat, shortDate } from '../lib/theme.ts'
import { SEVERITIES } from '../lib/types.ts'

export function ChartCard({ title, subtitle, children, right }: { title: string; subtitle?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card p-5 flex flex-col min-w-0">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
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

function TipShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/95 backdrop-blur px-3 py-2 text-xs shadow-xl shadow-black/40 min-w-36">
      <div className="text-ink-2 mb-1.5 font-medium">{title}</div>
      {children}
    </div>
  )
}

function TipRow({ color, label, value }: { color: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="size-2 rounded-sm" style={{ background: color }} />
      <span className="text-muted flex-1">{label}</span>
      <span className="text-ink tabular font-medium">{value}</span>
    </div>
  )
}

/* ---------- 1. Events over time, stacked by severity ---------- */
export function TimelineChart({ data }: { data: Record<string, number | string>[] }) {
  const Tip = ({ active, payload, label }: TipProps) => {
    if (!active || !payload?.length) return null
    const total = payload.reduce((s, p) => s + Number(p.value ?? 0), 0)
    return (
      <TipShell title={`${shortDate(String(label))} · ${total} events`}>
        {[...payload].reverse().map((p) => (
          <TipRow key={String(p.dataKey)} color={String(p.color)} label={String(p.dataKey)} value={p.value} />
        ))}
      </TipShell>
    )
  }
  return (
    <div>
      <Legend items={SEVERITIES.map((s) => ({ label: s, color: SEV_COLOR[s] }))} />
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barCategoryGap={data.length > 45 ? 1 : 3}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="day" {...axisProps} tickFormatter={shortDate} minTickGap={28} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip content={Tip} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
            {[...SEVERITIES].reverse().map((s, i) => (
              <Bar key={s} dataKey={s} stackId="a" fill={SEV_COLOR[s]} stroke={CHART.surface} strokeWidth={data.length > 45 ? 0 : 1} radius={i === 3 ? [3, 3, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/* ---------- 2. Ranked horizontal bars (types, buildings) ---------- */
export function RankedBars({
  data,
  color = CHART.ember,
  format = (v: number) => String(v),
  onSelect,
  selected = [],
}: {
  data: { name: string; value: number }[]
  color?: string
  format?: (v: number) => string
  onSelect?: (name: string) => void
  selected?: string[]
}) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.value - a.value), [data])
  const max = Math.max(1, ...sorted.map((d) => d.value))
  return (
    <ul className="space-y-2.5">
      {sorted.map((d) => {
        const dim = selected.length > 0 && !selected.includes(d.name)
        return (
          <li key={d.name}>
            <button
              type="button"
              onClick={() => onSelect?.(d.name)}
              className="group w-full text-left disabled:cursor-default"
              disabled={!onSelect}
              title={onSelect ? `Filter by ${d.name}` : undefined}
            >
              <div className="flex justify-between text-xs mb-1">
                <span className={dim ? 'text-muted' : 'text-ink-2 group-hover:text-ink'}>{d.name}</span>
                <span className="tabular text-ink font-medium">{format(d.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(d.value / max) * 100}%`, background: color, opacity: dim ? 0.3 : 1 }}
                />
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- 3. Weekday × hour heatmap ---------- */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat())
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null)
  return (
    <div className="relative">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: '32px repeat(24, minmax(0, 1fr))' }}>
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <div className="text-[10px] text-muted self-center">{DAYS[d]}</div>
            {row.map((v, h) => (
              <div
                key={h}
                onMouseEnter={() => setHover({ d, h })}
                onMouseLeave={() => setHover(null)}
                className="aspect-square rounded-[3px] transition-transform hover:scale-125 hover:z-10 hover:ring-2 hover:ring-surface"
                style={{ background: heat(v / max) }}
              />
            ))}
          </div>
        ))}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-[10px] text-muted text-center">
            {h % 6 === 0 ? String(h).padStart(2, '0') : ''}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3 text-[11px] text-muted">
        <span className="h-4">
          {hover ? (
            <>
              <span className="text-ink-2">
                {DAYS[hover.d]} {String(hover.h).padStart(2, '0')}:00–{String(hover.h).padStart(2, '0')}:59
              </span>{' '}
              · <span className="text-ink tabular font-medium">{grid[hover.d][hover.h]}</span> events
            </>
          ) : (
            'Hover a cell for counts (UTC)'
          )}
        </span>
        <span className="flex items-center gap-1.5">
          0
          <span className="h-2 w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${heat(0.01)}, ${heat(1)})` }} />
          {max}
        </span>
      </div>
    </div>
  )
}

/* ---------- 4. Weekly average response time ---------- */
export function ResponseTrend({ data }: { data: { week: string; value: number }[] }) {
  const Tip = ({ active, payload, label }: TipProps) =>
    active && payload?.length ? (
      <TipShell title={`Week of ${shortDate(String(label))}`}>
        <TipRow color={CHART.ai} label="Avg response" value={fmtDuration(Number(payload[0].value))} />
      </TipShell>
    ) : null
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="week" {...axisProps} tickFormatter={shortDate} minTickGap={24} />
          <YAxis {...axisProps} tickFormatter={(v) => `${Math.round(v / 60)}m`} />
          <Tooltip content={Tip} cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }} />
          <Line type="monotone" isAnimationActive={false} dataKey="value" stroke={CHART.ai} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
