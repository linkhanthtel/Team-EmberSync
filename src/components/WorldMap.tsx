import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import worldTopo from 'world-atlas/countries-110m.json'
import { fmtDuration } from '../lib/analytics.ts'
import { SITES } from '../lib/sites.ts'
import { CHART, SEV_COLOR } from '../lib/theme.ts'
import { BUILDINGS, type AlarmEvent, type Building } from '../lib/types.ts'

const W = 960
const H = 500
const projection = geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], { type: 'Sphere' })
const path = geoPath(projection)
const topo = worldTopo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>
const countries = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features
const SITE_COUNTRIES = new Set(['United States of America', 'United Kingdom', 'Australia', 'Netherlands', 'Singapore'])
const SPHERE = path({ type: 'Sphere' }) ?? ''
const GRATICULE = path(geoGraticule10()) ?? ''

// Region presets as [lng, lat] bounds — the map zooms with an animated transform.
const REGIONS = {
  World: null,
  Americas: [[-130, -10], [-40, 60]],
  Europe: [[-12, 42], [20, 60]],
  APAC: [[90, -45], [160, 25]],
} as const
type Region = keyof typeof REGIONS

const METRICS = {
  events: { label: 'Events', get: (s: SiteStats) => s.total, fmt: (v: number) => String(v) },
  critical: { label: 'Critical', get: (s: SiteStats) => s.critical, fmt: (v: number) => String(v) },
  open: { label: 'Open', get: (s: SiteStats) => s.open, fmt: (v: number) => String(v) },
  response: { label: 'Avg response', get: (s: SiteStats) => s.avgResponse, fmt: (v: number) => fmtDuration(v) },
} as const
type Metric = keyof typeof METRICS

export interface SiteStats {
  building: Building
  total: number
  critical: number
  open: number
  fires: number
  avgResponse: number
  latest: AlarmEvent | null
}

export function siteStats(events: AlarmEvent[]): SiteStats[] {
  return BUILDINGS.map((b) => {
    const es = events.filter((e) => e.building === b)
    const rs = es.filter((e) => e.responseTimeSec != null).map((e) => e.responseTimeSec!)
    return {
      building: b,
      total: es.length,
      critical: es.filter((e) => e.severity === 'Critical').length,
      open: es.filter((e) => e.status !== 'Resolved').length,
      fires: es.filter((e) => e.type === 'Fire').length,
      avgResponse: rs.length ? Math.round(rs.reduce((a, c) => a + c, 0) / rs.length) : 0,
      latest: es.reduce<AlarmEvent | null>((l, e) => (!l || e.timestamp > l.timestamp ? e : l), null),
    }
  })
}

// Label placement so London and Rotterdam don't collide at world zoom.
const LABEL_SIDE: Record<Building, 'left' | 'right'> = {
  'Harbor Tower': 'right',
  'Northgate Labs': 'left',
  'Riverside Mall': 'left',
  'Summit Hospital': 'right',
  'Westpark Warehouse': 'right',
}

export function WorldMap({
  events,
  selected = [],
  onSelect,
  height = 'auto',
  showControls = true,
}: {
  events: AlarmEvent[]
  selected?: Building[]
  onSelect?: (b: Building) => void
  height?: string
  showControls?: boolean
}) {
  const [metric, setMetric] = useState<Metric>('events')
  const [region, setRegion] = useState<Region>('World')
  const [hover, setHover] = useState<Building | null>(null)
  const stats = useMemo(() => siteStats(events), [events])

  const m = METRICS[metric]
  const max = Math.max(1, ...stats.map(m.get))

  // Zoom transform for the chosen region.
  const { k, tx, ty } = useMemo(() => {
    const b = REGIONS[region]
    if (!b) return { k: 1, tx: 0, ty: 0 }
    const [x0, y0] = projection([b[0][0], b[1][1]])!
    const [x1, y1] = projection([b[1][0], b[0][1]])!
    const k = Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.92
    return { k, tx: W / 2 - k * ((x0 + x1) / 2), ty: H / 2 - k * ((y0 + y1) / 2) }
  }, [region])

  const points = stats
    .map((s) => {
      const site = SITES[s.building]
      const [x, y] = projection([site.lng, site.lat])!
      const v = m.get(s)
      return { ...s, site, x, y, v, r: v ? 5 + 15 * Math.sqrt(v / max) : 3 }
    })
    .sort((a, b) => b.r - a.r) // small markers on top

  const hovered = points.find((p) => p.building === hover)

  return (
    <div>
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <Segmented options={Object.keys(METRICS) as Metric[]} value={metric} onChange={setMetric} label={(x) => METRICS[x].label} />
          <Segmented options={Object.keys(REGIONS) as Region[]} value={region} onChange={setRegion} label={(x) => x} />
        </div>
      )}
      <div className="relative overflow-hidden rounded-xl bg-[#0d0d10] border border-line" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" role="img" aria-label="World map of monitored sites">
          <defs>
            <radialGradient id="marker-glow">
              <stop offset="0%" stopColor={CHART.ember} stopOpacity="0.55" />
              <stop offset="100%" stopColor={CHART.ember} stopOpacity="0" />
            </radialGradient>
          </defs>
          <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})`, transformOrigin: '0 0', transition: 'transform 700ms cubic-bezier(.2,.8,.2,1)' }}>
            <path d={SPHERE} fill="#111115" />
            <path d={GRATICULE} fill="none" stroke="#1d1d22" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            {countries.map((c: Feature<Geometry, { name: string }>, i) => (
              <path
                key={i}
                d={path(c) ?? ''}
                fill={SITE_COUNTRIES.has(c.properties.name) ? '#2a2420' : '#1d1d22'}
                stroke="#2c2c32"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {points.map((p) => {
              const isSel = selected.includes(p.building)
              const dim = selected.length > 0 && !isSel
              const r = p.r / k
              return (
                <g
                  key={p.building}
                  transform={`translate(${p.x},${p.y})`}
                  onMouseEnter={() => setHover(p.building)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelect?.(p.building)}
                  className={onSelect ? 'cursor-pointer' : undefined}
                  opacity={dim ? 0.35 : 1}
                >
                  <circle r={r * 2.2} fill="url(#marker-glow)" />
                  {p.open > 0 && (
                    <circle r={r} fill="none" stroke={SEV_COLOR.Critical} strokeWidth={1.5} vectorEffect="non-scaling-stroke">
                      <animate attributeName="r" from={r} to={r * 2.4} dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.9" to="0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle
                    r={r}
                    fill={metric === 'response' ? CHART.ai : CHART.ember}
                    fillOpacity={0.85}
                    stroke={isSel || hover === p.building ? '#fff' : '#0d0d10'}
                    strokeWidth={isSel || hover === p.building ? 2 : 1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Generous invisible hit target */}
                  <circle r={Math.max(r, 14 / k)} fill="transparent" />
                  <text
                    x={(LABEL_SIDE[p.building] === 'left' ? -1 : 1) * (r + 5 / k)}
                    y={4 / k}
                    textAnchor={LABEL_SIDE[p.building] === 'left' ? 'end' : 'start'}
                    fontSize={12 / k}
                    fill="#c3c2b7"
                    stroke="#0d0d10"
                    strokeWidth={3 / k}
                    paintOrder="stroke"
                    className="pointer-events-none select-none"
                  >
                    {p.site.city} · {m.fmt(p.v)}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute z-10 w-60 rounded-lg border border-line bg-surface-2/95 backdrop-blur p-3 text-xs shadow-xl shadow-black/50"
              style={{
                left: `clamp(8px, calc(${((hovered.x * k + tx) / W) * 100}% - 120px), calc(100% - 248px))`,
                top: `calc(${((hovered.y * k + ty) / H) * 100}% + ${hovered.r + 10}px)`,
              }}
            >
              <div className="font-semibold text-ink text-sm">{hovered.building}</div>
              <div className="text-muted mb-2">
                {hovered.site.city}, {hovered.site.country} · {hovered.site.type}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <Stat label="Events" value={hovered.total} />
                <Stat label="Critical" value={hovered.critical} />
                <Stat label="Open" value={hovered.open} accent={hovered.open > 0} />
                <Stat label="Fires" value={hovered.fires} />
                <Stat label="Avg response" value={hovered.avgResponse ? fmtDuration(hovered.avgResponse) : '—'} />
              </div>
              {onSelect && <div className="mt-2 text-[10px] text-muted">Click to {selected.includes(hovered.building) ? 'remove' : 'add'} filter</div>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend */}
        <div className="absolute bottom-2.5 left-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: metric === 'response' ? CHART.ai : CHART.ember }} />
            Size = {m.label.toLowerCase()}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-[1.5px]" style={{ borderColor: SEV_COLOR.Critical }} />
            Pulsing ring = open alarms
          </span>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className={`tabular font-medium ${accent ? 'text-[#ff8a8d]' : 'text-ink'}`}>{value}</span>
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: T[]; value: T; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <div className="flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${value === o ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink-2'}`}
        >
          {label(o)}
        </button>
      ))}
    </div>
  )
}
