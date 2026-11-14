import { geoConicEqualArea, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { SENSOR_LABEL, confidenceLabel, shortCentre, type CentreFeature, type CentreSel, type FireCentre, type Metric, type MonthCell, type WatchDot } from '../lib/fire.ts'
import { CENTRE_COLOR, CHART, fireRamp, fmtInt, logScale } from '../lib/theme.ts'
import { fmtMetric } from './charts.tsx'

const W = 800
const H = 720
const HALF = 0.05 // half a 0.1° grid cell

type Hover =
  | { kind: 'cell'; x: number; y: number; cell: MonthCell }
  | { kind: 'dot'; x: number; y: number; dot: WatchDot }
  | { kind: 'centre'; x: number; y: number; centre: FireCentre; value?: string }

export function BcMap({
  centres,
  centre,
  onSelectCentre,
  variant = 'watch',
  cells = [],
  dots = [],
  metric = 'count',
  centreValue,
  loading,
}: {
  centres: CentreFeature[] | null
  centre: CentreSel
  onSelectCentre: (c: CentreSel) => void
  /** spot: centres in their categorical colours; watch: neutral centres + month cells + lone dots */
  variant?: 'spot' | 'watch'
  cells?: MonthCell[]
  dots?: WatchDot[]
  metric?: Metric
  centreValue?: (c: FireCentre) => string
  loading?: boolean
}) {
  const [hover, setHover] = useState<Hover | null>(null)

  const { path, projection, shapes } = useMemo(() => {
    const projection = geoConicEqualArea().parallels([50, 58.5]).rotate([126, 0])
    if (centres) projection.fitExtent([[12, 12], [W - 12, H - 12]], { type: 'FeatureCollection', features: centres } as GeoPermissibleObjects)
    const path = geoPath(projection)
    const shapes = (centres ?? []).map((f) => ({ f, d: path(f) ?? '', c: path.centroid(f), b: path.bounds(f) }))
    return { path, projection, shapes }
  }, [centres])

  // Zoom to the selected centre.
  const { k, tx, ty } = useMemo(() => {
    const s = centre && shapes.find((x) => x.f.properties.name === centre)
    if (!s) return { k: 1, tx: 0, ty: 0 }
    const [[x0, y0], [x1, y1]] = s.b
    const k = Math.min(4, Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.9)
    return { k, tx: W / 2 - k * ((x0 + x1) / 2), ty: H / 2 - k * ((y0 + y1) / 2) }
  }, [centre, shapes])

  const cellShapes = useMemo(() => {
    if (!centres) return []
    const max = Math.max(1, ...cells.map((c) => (metric === 'count' ? c.count : c.frp)))
    return cells
      .map((c) => {
        const ring: [number, number][] = [
          [c.lon - HALF, c.lat - HALF],
          [c.lon - HALF, c.lat + HALF],
          [c.lon + HALF, c.lat + HALF],
          [c.lon + HALF, c.lat - HALF],
          [c.lon - HALF, c.lat - HALF],
        ]
        const v = metric === 'count' ? c.count : c.frp
        return { c, v, d: path({ type: 'Polygon', coordinates: [ring] }) ?? '', fill: fireRamp(logScale(v, max)) }
      })
      .sort((a, b) => a.v - b.v) // hottest on top
  }, [cells, metric, path, centres])

  const dotPts = useMemo(() => (centres ? dots.map((d) => ({ d, p: projection([d.lon, d.lat]) })).filter((x) => x.p) : []), [dots, projection, centres])

  const dim = (c: FireCentre) => centre != null && centre !== c

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#0d0d10] border border-line">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Map of British Columbia fire centres">
        <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})`, transformOrigin: '0 0', transition: 'transform 700ms cubic-bezier(.2,.8,.2,1)' }}>
          {shapes.map(({ f, d }) => {
            const name = f.properties.name
            const sel = centre === name
            return (
              <path
                key={name}
                d={d}
                fill={variant === 'spot' ? CENTRE_COLOR[name] : sel ? '#22201e' : '#18181c'}
                fillOpacity={variant === 'spot' ? (dim(name) ? 0.12 : sel ? 0.55 : 0.32) : dim(name) ? 0.5 : 1}
                stroke={sel ? CHART.ember : '#3a3a40'}
                strokeWidth={sel ? 2 : 0.8}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer transition-[fill-opacity] duration-300"
                onClick={() => onSelectCentre(sel ? null : name)}
                onMouseMove={(e) => {
                  if (variant !== 'spot') return
                  const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  setHover({ kind: 'centre', x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, centre: name, value: centreValue?.(name) })
                }}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}

          {cellShapes.map(({ c, d, fill }) => (
            <path
              key={`${c.cellId}|${c.sensor}`}
              d={d}
              fill={fill}
              opacity={dim(c.centre) ? 0.25 : 1}
              stroke="#0d0d10"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
              onMouseEnter={() => {
                const p = projection([c.lon, c.lat])!
                setHover({ kind: 'cell', x: p[0] * k + tx, y: p[1] * k + ty, cell: c })
              }}
              onMouseLeave={() => setHover(null)}
            />
          ))}

          {dotPts.map(({ d, p }) => (
            <g
              key={d.id}
              transform={`translate(${p![0]},${p![1]})`}
              opacity={dim(d.centre) ? 0.25 : 1}
              onMouseEnter={() => setHover({ kind: 'dot', x: p![0] * k + tx, y: p![1] * k + ty, dot: d })}
              onMouseLeave={() => setHover(null)}
            >
              <circle r={7 / k} fill="transparent" />
              <circle r={2.2 / k} fill="none" stroke={d.lowConf ? CHART.ai : '#f0efec'} strokeOpacity={0.8} strokeWidth={1} strokeDasharray={d.lowConf ? '2 1.5' : undefined} vectorEffect="non-scaling-stroke" />
            </g>
          ))}

          {shapes.map(({ f, c }) => (
            <text
              key={f.properties.name}
              x={c[0]}
              y={c[1]}
              textAnchor="middle"
              fontSize={13 / k}
              fill={dim(f.properties.name) ? '#6f6e69' : '#c3c2b7'}
              stroke="#0d0d10"
              strokeWidth={3 / k}
              paintOrder="stroke"
              className="pointer-events-none select-none font-medium"
            >
              {shortCentre(f.properties.name)}
            </text>
          ))}
        </g>
      </svg>

      {(!centres || loading) && (
        <div className="absolute inset-0 grid place-items-center bg-[#0d0d10]/60">
          <div className="text-xs text-muted flex items-center gap-2">
            <span className="size-3 rounded-full border-2 border-ember border-t-transparent animate-spin" /> Loading map data…
          </div>
        </div>
      )}

      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute z-10 w-56 rounded-lg border border-line bg-surface-2/95 backdrop-blur p-3 text-xs shadow-xl shadow-black/50"
            style={{
              left: `clamp(8px, calc(${(hover.x / W) * 100}% - 112px), calc(100% - 232px))`,
              top: `calc(${(hover.y / H) * 100}% + 14px)`,
            }}
          >
            <HoverBody h={hover} metric={metric} />
          </motion.div>
        )}
      </AnimatePresence>

      {variant === 'watch' && (
        <div className="absolute bottom-2.5 left-3 right-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-10 rounded-sm" style={{ background: `linear-gradient(90deg, ${fireRamp(0)}, ${fireRamp(1)})` }} />
            0.1° cell · {metric === 'count' ? 'hotspots' : 'fire energy'} (log)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-[1.5px] border-ink" /> Lone dot (watch list)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-[1.5px] border-dashed border-ai" /> Low confidence
          </span>
        </div>
      )}
    </div>
  )
}

function HoverBody({ h, metric }: { h: Hover; metric: Metric }) {
  if (h.kind === 'centre')
    return (
      <>
        <div className="font-semibold text-ink text-sm">{h.centre}</div>
        {h.value && <div className="text-muted mt-1">{h.value}</div>}
        <div className="mt-2 text-[10px] text-muted">Click to focus</div>
      </>
    )
  if (h.kind === 'cell') {
    const c = h.cell
    return (
      <>
        <div className="font-semibold text-ink">
          Cell {c.lat.toFixed(2)}°N {Math.abs(c.lon).toFixed(2)}°W
        </div>
        <div className="text-muted mb-2">
          {shortCentre(c.centre)} · {SENSOR_LABEL[c.sensor]}
        </div>
        <Row label="Hotspots" value={fmtInt(c.count)} />
        <Row label="Fire energy" value={fmtMetric('energy', c.frp)} />
        <Row label="Low confidence" value={fmtInt(c.lowConf)} />
        {metric === 'energy' && <div className="mt-1 text-[10px] text-muted">Raw sensor values (not harmonised)</div>}
      </>
    )
  }
  const d = h.dot
  return (
    <>
      <div className="font-semibold text-ink">Lone dot · {d.date}</div>
      <div className="text-muted mb-2">
        {shortCentre(d.centre)} · {SENSOR_LABEL[d.sensor]} {d.satellite === 'N' ? 'S-NPP' : d.satellite} · {d.time.slice(0, 2)}:{d.time.slice(2)} UTC
      </div>
      <Row label="Position" value={`${d.lat.toFixed(3)}, ${d.lon.toFixed(3)}`} />
      <Row label="FRP" value={`${d.frp.toFixed(1)} MW`} />
      <Row label="Confidence" value={confidenceLabel(d)} />
      <Row label="Pass" value={d.day ? 'Day' : 'Night'} />
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="tabular font-medium text-ink">{value}</span>
    </div>
  )
}
