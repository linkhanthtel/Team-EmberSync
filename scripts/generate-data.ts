// Generates deterministic mock fire alarm data → src/data/alarms.json
// Run: npm run gen:data
import { writeFileSync, mkdirSync } from 'node:fs'
import {
  BUILDINGS,
  type AlarmEvent,
  type AlarmType,
  type Building,
  type DeviceType,
  type Severity,
  type Status,
} from '../src/lib/types.ts'

// Seeded PRNG (mulberry32) so the dataset is reproducible.
let seed = 20261112
function rand() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]
function weighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [v, w] of entries) if ((r -= w) <= 0) return v
  return entries[entries.length - 1][0]
}

const END = new Date('2026-11-12T18:00:00Z')
const DAYS = 90
const START = new Date(END.getTime() - DAYS * 86400_000)

const SITE: Record<Building, { floors: number; zones: string[]; weight: number }> = {
  'Harbor Tower': { floors: 32, zones: ['Lobby', 'Office Wing A', 'Office Wing B', 'Plant Room', 'Parking'], weight: 1.2 },
  'Northgate Labs': { floors: 6, zones: ['Chem Lab', 'Clean Room', 'Server Room', 'Storage', 'Loading Bay'], weight: 1.0 },
  'Riverside Mall': { floors: 4, zones: ['Food Court', 'Retail North', 'Retail South', 'Cinema', 'Car Park'], weight: 1.4 },
  'Summit Hospital': { floors: 9, zones: ['ICU', 'Kitchen', 'Radiology', 'Ward East', 'Ward West', 'Boiler Room'], weight: 1.3 },
  'Westpark Warehouse': { floors: 2, zones: ['Racking A', 'Racking B', 'Battery Charging', 'Dispatch'], weight: 0.8 },
}

const TYPE_WEIGHTS: [AlarmType, number][] = [
  ['Smoke', 26],
  ['False Alarm', 22],
  ['Fault', 18],
  ['Test', 12],
  ['Heat', 10],
  ['CO', 7],
  ['Fire', 5],
]

const DEVICE_FOR: Record<AlarmType, DeviceType[]> = {
  Fire: ['Smoke Detector', 'Heat Detector', 'Manual Call Point', 'Sprinkler Flow Switch'],
  Smoke: ['Smoke Detector'],
  Heat: ['Heat Detector'],
  CO: ['CO Sensor'],
  Fault: ['Control Panel', 'Smoke Detector', 'Heat Detector', 'CO Sensor'],
  'False Alarm': ['Smoke Detector', 'Manual Call Point', 'Heat Detector'],
  Test: ['Control Panel', 'Manual Call Point'],
}

const SEVERITY_FOR: Record<AlarmType, [Severity, number][]> = {
  Fire: [['Critical', 80], ['High', 20]],
  Smoke: [['High', 45], ['Medium', 40], ['Critical', 15]],
  Heat: [['High', 40], ['Medium', 45], ['Critical', 15]],
  CO: [['High', 50], ['Critical', 25], ['Medium', 25]],
  Fault: [['Medium', 40], ['Low', 60]],
  'False Alarm': [['Medium', 35], ['Low', 65]],
  Test: [['Low', 100]],
}

const NOTES: Record<AlarmType, string[]> = {
  Fire: [
    'Confirmed flame in {zone}; sprinklers activated, fire brigade attended.',
    'Small electrical fire contained with extinguisher; area evacuated.',
    'Kitchen fryer fire in {zone}; suppression system discharged.',
    'Smouldering cable tray found above ceiling; isolated and extinguished.',
  ],
  Smoke: [
    'Smoke detected in {zone}; source traced to overheated equipment.',
    'Light smoke from HVAC unit; maintenance notified.',
    'Smoke from burnt toast in staff pantry; area ventilated.',
    'Contractor hot works without permit triggered detector.',
  ],
  Heat: [
    'Rate-of-rise heat alarm in {zone}; equipment overheating.',
    'Ambient temperature exceeded threshold near boiler.',
    'Heat detector triggered by direct sunlight on skylight.',
  ],
  CO: [
    'Elevated CO (85 ppm) in {zone}; vehicles idling, ventilation boosted.',
    'CO leak from faulty gas heater; area evacuated and gas isolated.',
    'Generator exhaust drift detected; louvres closed.',
  ],
  Fault: [
    'Loop fault on panel; detector communication lost.',
    'Low battery on wireless detector.',
    'Earth fault reported on sounder circuit.',
    'Detector head dirty — contamination warning.',
  ],
  'False Alarm': [
    'Steam from shower activated detector.',
    'Dust from renovation work in {zone}.',
    'Manual call point accidentally activated by trolley.',
    'Aerosol spray near detector; no fire found.',
    'Cooking fumes; no fire found.',
  ],
  Test: ['Scheduled weekly call point test.', 'Quarterly panel inspection by contractor.', 'Sounder test — all zones.'],
}

const RESPONDERS = ['A. Mendez', 'J. Okafor', 'L. Chen', 'P. Novak', 'R. Singh', 'S. Haddad', 'T. Brooks', 'M. Rossi']

// Response time (seconds) by severity — critical is fastest.
const RESPONSE_RANGE: Record<Severity, [number, number]> = {
  Critical: [35, 180],
  High: [60, 420],
  Medium: [120, 900],
  Low: [300, 2400],
}

const events: AlarmEvent[] = []
const buildingWeights = BUILDINGS.map((b) => [b, SITE[b].weight] as [Building, number])

for (let d = 0; d <= DAYS; d++) {
  const day = new Date(START.getTime() + d * 86400_000)
  const weekday = day.getUTCDay()
  // Busier weekdays + an incident cluster mid-October in Riverside Mall.
  let count = 4 + Math.floor(rand() * 4) + (weekday >= 1 && weekday <= 5 ? 1 : 0)
  if (d >= 58 && d <= 62) count += 4

  for (let i = 0; i < count; i++) {
    const building = d >= 58 && d <= 62 && rand() < 0.5 ? 'Riverside Mall' : weighted(buildingWeights)
    const site = SITE[building]
    let type = weighted(TYPE_WEIGHTS)
    // Test alarms happen in business hours; other events skew toward daytime but occur at night.
    const hour =
      type === 'Test'
        ? 9 + Math.floor(rand() * 7)
        : weighted<number>(Array.from({ length: 24 }, (_, h) => [h, h >= 7 && h <= 20 ? 3 : 1]))
    const ts = new Date(day)
    ts.setUTCHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60))
    if (ts > END) continue
    // Westpark battery charging area has a CO/heat hotspot.
    let zone = pick(site.zones)
    if (building === 'Westpark Warehouse' && rand() < 0.35) {
      zone = 'Battery Charging'
      type = rand() < 0.5 ? 'Heat' : 'CO'
    }
    const severity = weighted(SEVERITY_FOR[type])
    const deviceType = pick(DEVICE_FOR[type])
    const floor = building === 'Riverside Mall' && zone === 'Car Park' ? 0 : 1 + Math.floor(rand() * site.floors)

    const ageHours = (END.getTime() - ts.getTime()) / 3600_000
    let status: Status = 'Resolved'
    if (ageHours < 6) status = rand() < 0.5 ? 'Active' : 'Acknowledged'
    else if (ageHours < 48 && rand() < 0.25) status = 'Acknowledged'

    const [lo, hi] = RESPONSE_RANGE[severity]
    // Night shift responds slower.
    const nightPenalty = hour < 6 || hour >= 22 ? 1.4 : 1
    const responseTimeSec = status === 'Active' ? null : Math.round((lo + rand() * (hi - lo)) * nightPenalty)

    const prefix = building.split(' ').map((w) => w[0]).join('')
    events.push({
      id: '',
      timestamp: ts.toISOString(),
      building,
      floor,
      zone,
      deviceId: `${prefix}-${String(floor).padStart(2, '0')}-${deviceType.split(' ').map((w) => w[0]).join('')}${100 + Math.floor(rand() * 80)}`,
      deviceType,
      type,
      severity,
      status,
      responseTimeSec,
      acknowledgedBy: status === 'Active' ? null : pick(RESPONDERS),
      notes: pick(NOTES[type]).replace('{zone}', zone),
    })
  }
}

events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
events.forEach((e, i) => (e.id = `EVT-${String(events.length - i).padStart(5, '0')}`))

mkdirSync('src/data', { recursive: true })
writeFileSync(
  'src/data/alarms.json',
  JSON.stringify({ generatedAt: END.toISOString(), rangeStart: START.toISOString(), rangeEnd: END.toISOString(), events }, null, 2),
)
console.log(`Wrote ${events.length} events to src/data/alarms.json`)
