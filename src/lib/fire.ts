// EmberSync data layer: types, CSV parsing and lazy loaders for the files in src/data/.
// The calendar (148 KB) and the FIRMS summary are bundled; the map cells (6 MB), the
// watch list (4 MB) and the fire-centre boundaries (0.5 MB) are fetched on first use.
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from 'geojson'
import calendarCsv from '../data/bc_monthly_calendar_2001_2025.csv?raw'
import cellsUrl from '../data/bc_month_cells_2001_2025.csv?url'
import watchUrl from '../data/bc_watch_list_2001_2025.csv?url'
import centresUrl from '../data/bc_fire_centres_simplified.geojson?url'
import firmsSummary from '../data/derived/firms_summary.json'

export const FIRE_CENTRES = [
  'Cariboo Fire Centre',
  'Coastal Fire Centre',
  'Kamloops Fire Centre',
  'Northwest Fire Centre',
  'Prince George Fire Centre',
  'Southeast Fire Centre',
] as const
export type FireCentre = (typeof FIRE_CENTRES)[number]
/** null = all of BC */
export type CentreSel = FireCentre | null

export const shortCentre = (c: FireCentre) => c.replace(' Fire Centre', '')

export type Sensor = 'MODIS' | 'VIIRS_SNPP'
export const SENSOR_LABEL: Record<Sensor, string> = { MODIS: 'MODIS', VIIRS_SNPP: 'VIIRS S-NPP' }

export const YEARS = Array.from({ length: 25 }, (_, i) => 2001 + i)
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** First year the calendar reads VIIRS as observed instead of MODIS x factor. */
export const VIIRS_FROM = 2012
/** Published MODIS→VIIRS factors (README); refitted live in fitFactors() as a check. */
export const FACTORS = { count: 4.92, energy: 0.52 } as const

export const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`
export const ymLabel = (s: string) => `${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`
export const calendarSensor = (year: number): Sensor => (year >= VIIRS_FROM ? 'VIIRS_SNPP' : 'MODIS')

/* ------------------------------------------------------------------ CSV */

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  // These files are machine-written: no quoted fields, LF or CRLF line endings.
  const lines = text.split(/\r?\n/)
  const header = lines[0].split(',')
  const rows: string[][] = []
  for (let i = 1; i < lines.length; i++) if (lines[i]) rows.push(lines[i].split(','))
  return { header, rows }
}

function columns<K extends string>(header: string[], keys: readonly K[]): Record<K, number> {
  const out = {} as Record<K, number>
  for (const k of keys) {
    const i = header.indexOf(k)
    if (i < 0) throw new Error(`EmberSync data: missing column "${k}"`)
    out[k] = i
  }
  return out
}

/* ------------------------------------------------------------- Calendar */

export interface CalendarRow {
  centre: FireCentre
  year: number
  month: number
  ym: string
  countModis: number
  countViirs: number
  energyModis: number
  energyViirs: number
  lowConfModis: number
  lowConfViirs: number
  count: number // harmonised
  energy: number // harmonised, MW
  from: 'MODIS x factor' | 'VIIRS_SNPP'
}

export const CALENDAR: CalendarRow[] = (() => {
  const { header, rows } = parseCsv(calendarCsv)
  const c = columns(header, [
    'fire_centre', 'year', 'month', 'ym', 'count_MODIS', 'count_VIIRS_SNPP', 'fire_energy_mw_MODIS',
    'fire_energy_mw_VIIRS_SNPP', 'low_conf_MODIS', 'low_conf_VIIRS_SNPP', 'count_harmonised',
    'fire_energy_harmonised_mw', 'harmonised_from',
  ] as const)
  return rows.map((r) => ({
    centre: r[c.fire_centre] as FireCentre,
    year: +r[c.year],
    month: +r[c.month],
    ym: r[c.ym],
    countModis: +r[c.count_MODIS],
    countViirs: +r[c.count_VIIRS_SNPP],
    energyModis: +r[c.fire_energy_mw_MODIS],
    energyViirs: +r[c.fire_energy_mw_VIIRS_SNPP],
    lowConfModis: +r[c.low_conf_MODIS],
    lowConfViirs: +r[c.low_conf_VIIRS_SNPP],
    count: +r[c.count_harmonised],
    energy: +r[c.fire_energy_harmonised_mw],
    from: r[c.harmonised_from] as CalendarRow['from'],
  }))
})()

const CAL_INDEX = new Map(CALENDAR.map((r) => [`${r.centre}|${r.ym}`, r]))

export type Metric = 'count' | 'energy'
export const METRIC_LABEL: Record<Metric, string> = { count: 'Hotspots', energy: 'Fire energy' }

/** One calendar month for a centre, or the sum over all of BC when centre is null. */
export function calendarCell(centre: CentreSel, ymKey: string): CalendarRow {
  if (centre) return CAL_INDEX.get(`${centre}|${ymKey}`)!
  const parts = FIRE_CENTRES.map((c) => CAL_INDEX.get(`${c}|${ymKey}`)!)
  const sum = (k: keyof CalendarRow) => parts.reduce((s, p) => s + (p[k] as number), 0)
  const p0 = parts[0]
  return {
    ...p0,
    centre: p0.centre,
    countModis: sum('countModis'),
    countViirs: sum('countViirs'),
    energyModis: sum('energyModis'),
    energyViirs: sum('energyViirs'),
    lowConfModis: sum('lowConfModis'),
    lowConfViirs: sum('lowConfViirs'),
    count: sum('count'),
    energy: sum('energy'),
  }
}

export const metricOf = (r: CalendarRow, m: Metric) => (m === 'count' ? r.count : r.energy)
export const lowConfOf = (r: CalendarRow) => (r.year >= VIIRS_FROM ? r.lowConfViirs : r.lowConfModis)
export const rawCountOf = (r: CalendarRow) => (r.year >= VIIRS_FROM ? r.countViirs : r.countModis)

/** 25 × 12 grid of harmonised values. */
export function calendarGrid(centre: CentreSel, m: Metric): number[][] {
  return YEARS.map((y) => MONTHS.map((_, i) => metricOf(calendarCell(centre, ym(y, i + 1)), m)))
}

/** Least-squares-through-origin fit of VIIRS on MODIS over the overlap years (per centre-month). */
export function fitFactors() {
  const overlap = CALENDAR.filter((r) => r.year >= VIIRS_FROM)
  const fit = (x: (r: CalendarRow) => number, y: (r: CalendarRow) => number) => {
    let sxy = 0, sxx = 0, sx = 0, sy = 0, syy = 0
    for (const r of overlap) {
      const a = x(r), b = y(r)
      sxy += a * b; sxx += a * a; sx += a; sy += b; syy += b * b
    }
    const n = overlap.length
    const r = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy))
    return { k: sxy / sxx, r }
  }
  return {
    n: overlap.length,
    count: fit((r) => r.countModis, (r) => r.countViirs),
    energy: fit((r) => r.energyModis, (r) => r.energyViirs),
    points: overlap.map((r) => ({
      centre: r.centre, ym: r.ym,
      countModis: r.countModis, countViirs: r.countViirs,
      energyModis: r.energyModis, energyViirs: r.energyViirs,
    })),
  }
}

/* ------------------------------------------------------- FIRMS summary */

export const FIRMS = firmsSummary as {
  total: { count: number; lowConf: number; day: number; frp: number }
  bySensorYear: Record<Sensor, { year: number; count: number; lowConf: number; day: number; frp: number }[]>
  bySatellite: Record<string, { count: number; lowConf: number; day: number; frp: number }>
  byCentre: Record<FireCentre, { count: number; lowConf: number; day: number; frp: number }>
}

/** Canada archive size before cleaning (README, FIRMS download of 14 Nov 2026). */
export const CANADA_RAW_DETECTIONS = 8_250_767

/* --------------------------------------------------------- Lazy files */

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null
  return () => (p ??= load().catch((e) => ((p = null), Promise.reject(e))))
}

async function fetchText(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return res.text()
}

export interface MonthCell {
  cellId: string
  lat: number
  lon: number
  centre: FireCentre
  sensor: Sensor
  count: number
  frp: number
  lowConf: number
}

/** Map cells indexed by ym. */
export const loadMonthCells = once(async () => {
  const { header, rows } = parseCsv(await fetchText(cellsUrl))
  const c = columns(header, ['ym', 'cell_id', 'cell_lat', 'cell_lon', 'fire_centre', 'sensor', 'count', 'frp_sum_mw', 'low_conf'] as const)
  const byYm = new Map<string, MonthCell[]>()
  for (const r of rows) {
    const k = r[c.ym]
    let list = byYm.get(k)
    if (!list) byYm.set(k, (list = []))
    list.push({
      cellId: r[c.cell_id],
      lat: +r[c.cell_lat],
      lon: +r[c.cell_lon],
      centre: r[c.fire_centre] as FireCentre,
      sensor: r[c.sensor] as Sensor,
      count: +r[c.count],
      frp: +r[c.frp_sum_mw],
      lowConf: +r[c.low_conf],
    })
  }
  return byYm
})

export interface WatchDot {
  id: number
  sensor: Sensor
  satellite: string
  date: string
  time: string // HHMM UTC
  lat: number
  lon: number
  cellId: string
  centre: FireCentre
  confidence: string
  lowConf: boolean
  frp: number
  day: boolean
  /** Nearest GeoNames populated place; distance/bearing run from the place to the dot. */
  place: Landmark
  /** Nearest GeoNames natural feature (lake, mountain, valley…). */
  feature: Landmark
}

export interface Landmark {
  name: string
  type: string
  km: number
  bearing: string
}

/** "13 km SSW of Sikanni Chief" (or "at Taylor" when under 1 km). */
export const describeLandmark = (l: Landmark) => (l.km < 1 ? `at ${l.name}` : `${l.km < 10 ? l.km.toFixed(1) : Math.round(l.km)} km ${l.bearing} of ${l.name}`)

const VIIRS_CONF: Record<string, string> = { l: 'low', n: 'nominal', h: 'high' }
/** MODIS confidence is 0–100; VIIRS is l/n/h. */
export const confidenceLabel = (d: Pick<WatchDot, 'sensor' | 'confidence'>) => (d.sensor === 'VIIRS_SNPP' ? (VIIRS_CONF[d.confidence] ?? d.confidence) : `${d.confidence}%`)

/** Lone dots grouped by nearest place, most dots first (ties: closest average distance). */
export function placesToWatch(dots: WatchDot[]) {
  const by = new Map<string, { place: string; n: number; km: number; frp: number; lowConf: number }>()
  for (const d of dots) {
    const e = by.get(d.place.name) ?? { place: d.place.name, n: 0, km: 0, frp: 0, lowConf: 0 }
    e.n++
    e.km += d.place.km
    e.frp += d.frp
    if (d.lowConf) e.lowConf++
    by.set(d.place.name, e)
  }
  return [...by.values()].map((e) => ({ ...e, km: e.km / e.n })).sort((a, b) => b.n - a.n || a.km - b.km)
}

/** Watch list (lone dots, with GeoNames place names) indexed by ym. */
export const loadWatchList = once(async () => {
  const { header, rows } = parseCsv(await fetchText(watchUrl))
  const c = columns(header, ['sensor', 'satellite', 'acq_date', 'acq_time', 'latitude', 'longitude', 'cell_id', 'fire_centre', 'confidence', 'low_conf', 'frp', 'daynight',
    'nearest_place', 'place_type', 'place_distance_km', 'place_bearing', 'nearest_feature', 'feature_type', 'feature_distance_km', 'feature_bearing'] as const)
  const byYm = new Map<string, WatchDot[]>()
  rows.forEach((r, id) => {
    const date = r[c.acq_date]
    const k = date.slice(0, 7)
    let list = byYm.get(k)
    if (!list) byYm.set(k, (list = []))
    list.push({
      id,
      sensor: r[c.sensor] as Sensor,
      satellite: r[c.satellite],
      date,
      time: r[c.acq_time].padStart(4, '0'),
      lat: +r[c.latitude],
      lon: +r[c.longitude],
      cellId: r[c.cell_id],
      centre: r[c.fire_centre] as FireCentre,
      confidence: r[c.confidence],
      lowConf: r[c.low_conf] === 'True',
      frp: +r[c.frp],
      day: r[c.daynight] === 'D',
      place: { name: r[c.nearest_place], type: r[c.place_type], km: +r[c.place_distance_km], bearing: r[c.place_bearing] },
      feature: { name: r[c.nearest_feature], type: r[c.feature_type], km: +r[c.feature_distance_km], bearing: r[c.feature_bearing] },
    })
  })
  return byYm
})

export type CentreFeature = Feature<Polygon | MultiPolygon, { name: FireCentre }>

/**
 * Fire-centre boundaries. The file follows RFC 7946 (counter-clockwise exterior rings);
 * d3-geo expects clockwise exteriors on the sphere, so every ring is reversed here.
 */
export const loadCentres = once(async () => {
  const fc = JSON.parse(await fetchText(centresUrl)) as FeatureCollection<Polygon | MultiPolygon, { MOF_FIRE_CENTRE_NAME: string }>
  const rev = (rings: Position[][]) => rings.map((r) => [...r].reverse())
  return fc.features.map(
    (f): CentreFeature => ({
      type: 'Feature',
      properties: { name: f.properties.MOF_FIRE_CENTRE_NAME as FireCentre },
      geometry:
        f.geometry.type === 'Polygon'
          ? { type: 'Polygon', coordinates: rev(f.geometry.coordinates) }
          : { type: 'MultiPolygon', coordinates: f.geometry.coordinates.map(rev) },
    }),
  )
})
