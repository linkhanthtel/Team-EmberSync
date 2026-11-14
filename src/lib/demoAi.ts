// Offline "demo mode" AI: a rule-based query parser and a templated briefing.
// Used when no ANTHROPIC_API_KEY is configured or the user toggles Demo mode.
import { digest, fmtDuration } from './analytics.ts'
import { SITES } from './sites.ts'
import {
  ALARM_TYPES,
  BUILDINGS,
  EMPTY_FILTERS,
  SEVERITIES,
  STATUSES,
  type AlarmEvent,
  type Filters,
} from './types.ts'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => {
  const d = new Date(s + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}

export function demoParseQuery(query: string, today: string): { filters: Filters; interpretation: string } {
  const q = query.toLowerCase()
  const f: Filters = structuredClone(EMPTY_FILTERS)
  const parts: string[] = []

  for (const b of BUILDINGS) {
    const first = b.split(' ')[0].toLowerCase()
    const site = SITES[b]
    if (q.includes(b.toLowerCase()) || q.includes(first) || q.includes(site.city.toLowerCase()) || q.includes(site.country.toLowerCase()))
      f.buildings.push(b)
  }
  if (/\b(usa|america)\b/.test(q)) f.buildings = [...new Set([...f.buildings, 'Northgate Labs' as const])]
  if (/\b(uk|britain|england)\b/.test(q)) f.buildings = [...new Set([...f.buildings, 'Riverside Mall' as const])]
  if (/\beurope\b/.test(q)) f.buildings = [...new Set([...f.buildings, 'Riverside Mall' as const, 'Westpark Warehouse' as const])]
  if (/\b(asia|apac|asia-pacific)\b/.test(q)) f.buildings = [...new Set([...f.buildings, 'Harbor Tower' as const, 'Summit Hospital' as const])]
  if (q.includes('hospital')) f.buildings = [...new Set([...f.buildings, 'Summit Hospital' as const])]
  if (q.includes('mall')) f.buildings = [...new Set([...f.buildings, 'Riverside Mall' as const])]
  if (q.includes('warehouse')) f.buildings = [...new Set([...f.buildings, 'Westpark Warehouse' as const])]

  const typeWords: Record<string, (typeof ALARM_TYPES)[number]> = {
    fire: 'Fire', smoke: 'Smoke', heat: 'Heat', 'carbon monoxide': 'CO', ' co ': 'CO',
    fault: 'Fault', false: 'False Alarm', nuisance: 'False Alarm', test: 'Test', drill: 'Test',
  }
  for (const [w, t] of Object.entries(typeWords)) {
    if (` ${q} `.includes(w) && !f.types.includes(t)) {
      // "fire alarms" alone shouldn't mean type=Fire when other types are named.
      if (t === 'Fire' && /fire alarm/.test(q) && !/actual fire|real fire|fires\b/.test(q)) continue
      f.types.push(t)
    }
  }
  const word = (w: string) => new RegExp(`\\b${w.toLowerCase()}\\b`).test(q)
  for (const s of SEVERITIES) if (word(s)) f.severities.push(s)
  if (q.includes('urgent') || q.includes('serious')) f.severities = [...new Set([...f.severities, 'Critical' as const, 'High' as const])]
  for (const s of STATUSES) if (word(s)) f.statuses.push(s)
  if (/\b(open|unresolved|ongoing)\b/.test(q)) f.statuses = ['Active', 'Acknowledged']

  const floor = q.match(/floor (\d+)|(\d+)(?:st|nd|rd|th) floor/)
  if (floor) f.floors = [Number(floor[1] ?? floor[2])]

  const lastN = q.match(/last (\d+) (day|week|month)s?/)
  if (lastN) {
    const n = Number(lastN[1]) * (lastN[2] === 'week' ? 7 : lastN[2] === 'month' ? 30 : 1)
    f.dateFrom = addDays(today, -n + 1)
    parts.push(`the last ${lastN[1]} ${lastN[2]}s`)
  } else if (q.includes('today')) {
    f.dateFrom = today
    parts.push('today')
  } else if (q.includes('yesterday')) {
    f.dateFrom = f.dateTo = addDays(today, -1)
    parts.push('yesterday')
  } else if (q.includes('this week') || q.includes('last week') || q.includes('past week')) {
    f.dateFrom = addDays(today, -6)
    parts.push('the past 7 days')
  } else if (q.includes('this month') || q.includes('last month') || q.includes('past month')) {
    f.dateFrom = addDays(today, -29)
    parts.push('the past 30 days')
  }
  if (/night|overnight|after hours|after-hours/.test(q)) {
    f.hourFrom = 22
    f.hourTo = 5
    parts.push('overnight (22:00–05:59)')
  }
  if (/slow|delayed|longest/.test(q)) {
    f.sortBy = 'slowest_response'
    if (!/longest|slowest/.test(q)) f.minResponseSec = 600
  }
  if (/oldest|earliest/.test(q)) f.sortBy = 'oldest'
  for (const zone of ['kitchen', 'icu', 'server room', 'battery', 'food court', 'parking', 'car park', 'lobby', 'boiler']) {
    if (q.includes(zone)) f.text = zone
  }

  const what = [
    f.severities.join('/'),
    f.statuses.join('/'),
    f.types.length ? f.types.join(', ') : 'alarm',
  ].filter(Boolean).join(' ')
  const where = f.buildings.length ? ` in ${f.buildings.join(', ')}` : ' across all buildings'
  const extra = [f.floors.length ? `floor ${f.floors[0]}` : '', f.text ? `matching “${f.text}”` : '', ...parts]
    .filter(Boolean)
    .join(', ')
  const sort = f.sortBy === 'slowest_response' ? ', slowest response first' : ''
  return { filters: f, interpretation: `Showing ${what} events${where}${extra ? ` — ${extra}` : ''}${sort}.` }
}

export function demoBriefing(events: AlarmEvent[]): string {
  const d = digest(events)
  if (!events.length) return '## No events\n\nNothing matches the current filters.'
  const k = d.kpis
  const topBuilding = [...d.byBuilding].sort((a, b) => b.value - a.value)[0]
  const slowest = [...d.responseByBuilding].filter((r) => r.n).sort((a, b) => b.value - a.value)[0]
  const topType = [...d.byType].sort((a, b) => b.value - a.value)[0]
  const hot = d.hotspots[0]
  return `## Situation overview
${k.total} events between **${d.range?.from}** and **${d.range?.to}**, including **${k.critical} critical** and **${k.fires} confirmed fires**. ${k.active ? `**${k.active} events remain open** and need follow-up.` : 'All events are resolved.'}

## Key findings
- **${topBuilding.name}** generated the most activity (${topBuilding.value} events).
- **${topType.name}** is the most common alarm type (${topType.value} events).
- False alarm rate is **${(k.falseAlarmRate * 100).toFixed(0)}%** of non-test events — ${k.falseAlarmRate > 0.2 ? 'above the 20% target' : 'within the 20% target'}.
- Hotspot: **${hot?.name}** with ${hot?.value} events.
- Average response time is **${fmtDuration(k.avgResponseSec)}**; ${slowest ? `${slowest.name} is slowest at ${fmtDuration(slowest.value)}` : ''}.

## Recommended actions
1. Review open events and confirm each has an assigned responder.
2. Inspect detectors in **${hot?.name}** for contamination or poor placement.
3. Target false alarms with signage and detector-type changes in high-nuisance zones.
4. Brief the night shift on response-time targets at ${slowest?.name ?? 'the slowest site'}.

_Demo mode — this briefing is generated from templates. Add an Anthropic API key for live Claude analysis._`
}
