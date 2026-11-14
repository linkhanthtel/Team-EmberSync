import {
  ALARM_TYPES,
  BUILDINGS,
  SEVERITIES,
  type AlarmEvent,
  type Filters,
} from './types.ts'

const hourOf = (e: AlarmEvent) => new Date(e.timestamp).getUTCHours()
const dayOf = (e: AlarmEvent) => e.timestamp.slice(0, 10)

export function applyFilters(events: AlarmEvent[], f: Filters): AlarmEvent[] {
  const text = f.text?.trim().toLowerCase()
  const out = events.filter((e) => {
    if (f.buildings.length && !f.buildings.includes(e.building)) return false
    if (f.types.length && !f.types.includes(e.type)) return false
    if (f.severities.length && !f.severities.includes(e.severity)) return false
    if (f.statuses.length && !f.statuses.includes(e.status)) return false
    if (f.floors.length && !f.floors.includes(e.floor)) return false
    const day = dayOf(e)
    if (f.dateFrom && day < f.dateFrom) return false
    if (f.dateTo && day > f.dateTo) return false
    if (f.hourFrom != null && f.hourTo != null) {
      const h = hourOf(e)
      const inRange = f.hourFrom <= f.hourTo ? h >= f.hourFrom && h <= f.hourTo : h >= f.hourFrom || h <= f.hourTo
      if (!inRange) return false
    }
    if (f.minResponseSec != null && (e.responseTimeSec ?? Infinity) < f.minResponseSec) return false
    if (text) {
      const hay = `${e.id} ${e.zone} ${e.deviceId} ${e.deviceType} ${e.notes} ${e.acknowledgedBy ?? ''}`.toLowerCase()
      if (!text.split(/\s+/).every((t) => hay.includes(t))) return false
    }
    return true
  })
  if (f.sortBy === 'oldest') out.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  else if (f.sortBy === 'slowest_response') out.sort((a, b) => (b.responseTimeSec ?? 1e9) - (a.responseTimeSec ?? 1e9))
  else out.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return out
}

export function countBy<K extends string>(events: AlarmEvent[], key: (e: AlarmEvent) => K, keys: readonly K[]) {
  const m = new Map<K, number>(keys.map((k) => [k, 0]))
  for (const e of events) m.set(key(e), (m.get(key(e)) ?? 0) + 1)
  return keys.map((k) => ({ name: k, value: m.get(k) ?? 0 }))
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function kpis(events: AlarmEvent[]) {
  const responded = events.filter((e) => e.responseTimeSec != null).map((e) => e.responseTimeSec!)
  const realIncidents = events.filter((e) => e.type !== 'Test')
  return {
    total: events.length,
    active: events.filter((e) => e.status !== 'Resolved').length,
    critical: events.filter((e) => e.severity === 'Critical').length,
    fires: events.filter((e) => e.type === 'Fire').length,
    avgResponseSec: Math.round(avg(responded)),
    falseAlarmRate: realIncidents.length
      ? events.filter((e) => e.type === 'False Alarm').length / realIncidents.length
      : 0,
  }
}

/** Daily counts stacked by severity, covering every day in [from, to]. */
export function dailyBySeverity(events: AlarmEvent[], from: string, to: string) {
  const rows = new Map<string, Record<string, number | string>>()
  for (let d = new Date(from + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    rows.set(key, { day: key, ...Object.fromEntries(SEVERITIES.map((s) => [s, 0])) })
  }
  for (const e of events) {
    const r = rows.get(dayOf(e))
    if (r) r[e.severity] = (r[e.severity] as number) + 1
  }
  return [...rows.values()]
}

/** 7×24 grid: weekday (Mon..Sun) × hour of day. */
export function hourHeatmap(events: AlarmEvent[]) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])
  for (const e of events) {
    const d = new Date(e.timestamp)
    grid[(d.getUTCDay() + 6) % 7][d.getUTCHours()]++
  }
  return grid
}

export function responseByBuilding(events: AlarmEvent[]) {
  return BUILDINGS.map((b) => {
    const xs = events.filter((e) => e.building === b && e.responseTimeSec != null).map((e) => e.responseTimeSec!)
    return { name: b, value: Math.round(avg(xs)), n: xs.length }
  })
}

export function weeklyResponse(events: AlarmEvent[]) {
  const weeks = new Map<string, number[]>()
  for (const e of events) {
    if (e.responseTimeSec == null) continue
    const d = new Date(e.timestamp)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    const k = d.toISOString().slice(0, 10)
    weeks.set(k, [...(weeks.get(k) ?? []), e.responseTimeSec])
  }
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, xs]) => ({ week, value: Math.round(avg(xs)) }))
}

/** Compact, text-friendly digest used as grounding for AI summaries. */
export function digest(events: AlarmEvent[]) {
  const k = kpis(events)
  const zoneCounts = new Map<string, number>()
  for (const e of events) zoneCounts.set(`${e.building} / ${e.zone}`, (zoneCounts.get(`${e.building} / ${e.zone}`) ?? 0) + 1)
  const hotspots = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const days = events.map(dayOf).sort()
  return {
    range: days.length ? { from: days[0], to: days[days.length - 1] } : null,
    kpis: k,
    byType: countBy(events, (e) => e.type, ALARM_TYPES),
    bySeverity: countBy(events, (e) => e.severity, SEVERITIES),
    byBuilding: countBy(events, (e) => e.building, BUILDINGS),
    responseByBuilding: responseByBuilding(events),
    hotspots: hotspots.map(([name, value]) => ({ name, value })),
    openEvents: events.filter((e) => e.status !== 'Resolved').slice(0, 15),
    recentCritical: events.filter((e) => e.severity === 'Critical').slice(0, 12),
  }
}

export const fmtDuration = (sec: number) =>
  sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${(sec / 3600).toFixed(1)}h`
