// "Make the call" insights: one sentence (≤ 25 words) per fire centre and month.
//
// The team's reviewed Gemini insights are read from any CSV in src/data/ whose name
// contains "insights" (columns: fire_centre, ym, insight). Until that file lands, the
// app shows rule-based drafts built from the calendar with the same rules as the
// prompt template: data numbers only, sensor + date range named, one watch-list area.
import {
  CALENDAR,
  FIRE_CENTRES,
  MONTHS,
  SENSOR_LABEL,
  calendarCell,
  calendarSensor,
  shortCentre,
  ymLabel,
  type CalendarRow,
  type FireCentre,
  type WatchDot,
} from './fire.ts'

export type InsightSource = 'reviewed' | 'draft'
export interface Insight {
  centre: FireCentre
  ym: string
  text: string
  source: InsightSource
  /** Harmonised hotspots that month, for sorting. */
  count: number
  /** Ratio to the 2001–2025 mean for the same calendar month (null when the mean is 0). */
  ratio: number | null
}

/* ----------------------------------------------- team-reviewed insights */

const reviewedFiles = import.meta.glob('../data/*insights*.csv', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function parseReviewed(): Map<string, string> {
  const out = new Map<string, string>()
  for (const text of Object.values(reviewedFiles)) {
    const [head, ...lines] = text.split(/\r?\n/).filter(Boolean)
    const h = splitCsvLine(head)
    const ic = h.indexOf('fire_centre'), iy = h.indexOf('ym'), ii = h.indexOf('insight')
    if (ic < 0 || iy < 0 || ii < 0) continue
    for (const l of lines) {
      const f = splitCsvLine(l)
      if (f[ii]) out.set(`${f[ic]}|${f[iy]}`, f[ii])
    }
  }
  return out
}

/** Minimal RFC 4180 line split: insight sentences may contain quoted commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') q = false
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

const REVIEWED = parseReviewed()
export const HAS_REVIEWED = REVIEWED.size > 0

/* ------------------------------------------------------- draft insights */

// Mean harmonised hotspots per (centre, calendar month) over 2001–2025.
const monthMean = new Map<string, number>()
for (const c of FIRE_CENTRES)
  for (let m = 1; m <= 12; m++) {
    const rows = CALENDAR.filter((r) => r.centre === c && r.month === m)
    monthMean.set(`${c}|${m}`, rows.reduce((s, r) => s + r.count, 0) / rows.length)
  }

const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US')
const fmtLat = (lat: number) => `${lat.toFixed(2)}°N`
const fmtLon = (lon: number) => `${Math.abs(lon).toFixed(2)}°W`

/** The 0.1° cell with the most lone dots for this centre-month, if any. */
function watchArea(dots: WatchDot[] | undefined, centre: FireCentre) {
  if (!dots) return null
  const by = new Map<string, { n: number; lat: number; lon: number }>()
  for (const d of dots) {
    if (d.centre !== centre) continue
    const e = by.get(d.cellId) ?? { n: 0, lat: 0, lon: 0 }
    e.n++
    e.lat += d.lat
    e.lon += d.lon
    by.set(d.cellId, e)
  }
  let best: { n: number; lat: number; lon: number } | null = null
  for (const e of by.values()) if (!best || e.n > best.n) best = e
  return best && { n: best.n, lat: best.lat / best.n, lon: best.lon / best.n }
}

function draft(r: CalendarRow, dots: WatchDot[] | undefined): Pick<Insight, 'text' | 'ratio'> {
  const sensor = calendarSensor(r.year)
  const what = sensor === 'MODIS' ? 'harmonised hotspots (MODIS ×4.92, 2001–2011)' : `${SENSOR_LABEL[sensor]} hotspots (2012–2025)`
  const name = shortCentre(r.centre)
  const when = ymLabel(r.ym)
  const mean = monthMean.get(`${r.centre}|${r.month}`) ?? 0
  const ratio = mean > 0 ? r.count / mean : null
  const mName = MONTHS[r.month - 1]

  if (!Number.isFinite(r.count)) return { text: `${name}, ${when}: Insufficient data.`, ratio: null }
  if (r.count === 0) return { text: `${name}, ${when}: no ${what}; ${mName} mean is ${fmtInt(mean)}.`, ratio }

  const vs =
    ratio == null ? '' : ratio >= 1.5 ? `, ${ratio.toFixed(1)}× the ${mName} mean` : ratio <= 0.5 ? `, ${Math.round(ratio * 100)}% of the ${mName} mean` : `, near the ${mName} mean`
  const area = watchArea(dots, r.centre)
  const watch = area ? `; watch ${area.n} lone dot${area.n > 1 ? 's' : ''} near ${fmtLat(area.lat)} ${fmtLon(area.lon)}` : ''
  return { text: `${name}, ${when}: ${fmtInt(r.count)} ${what}${vs}${watch}.`, ratio }
}

function toInsight(r: CalendarRow, dots: WatchDot[] | undefined): Insight {
  const reviewed = REVIEWED.get(`${r.centre}|${r.ym}`)
  const d = draft(r, dots)
  return { centre: r.centre, ym: r.ym, text: reviewed ?? d.text, source: reviewed ? 'reviewed' : 'draft', count: r.count, ratio: d.ratio }
}

/** All 1,800 centre-month insights. Pass the watch list once it has loaded to add watch areas. */
export function buildInsights(watch: Map<string, WatchDot[]> | null): Insight[] {
  return CALENDAR.map((r) => toInsight(r, watch?.get(r.ym)))
}

/** One centre-month insight; dots = that month's watch list. */
export function insightFor(centre: FireCentre, ym: string, dots: WatchDot[] | undefined): Insight {
  return toInsight(calendarCell(centre, ym), dots)
}

export function insightsCsv(rows: Insight[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return ['fire_centre,ym,insight,status', ...rows.map((r) => [r.centre, r.ym, r.text, r.source === 'reviewed' ? 'team reviewed' : 'draft'].map(esc).join(','))].join('\n') + '\n'
}

