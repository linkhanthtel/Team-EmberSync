// Summarises the raw cleaned detections (22 MB gzip, 1.79M rows) into a small JSON
// the browser can load: per-sensor yearly counts, low-confidence share, day/night split
// and totals per fire centre. Run: npm run gen:summary
import { createReadStream, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'

const SRC = 'src/data/bc_firms_clean_2001_2025.csv.gz'
const OUT = 'src/data/derived/firms_summary.json'

type Tally = { count: number; lowConf: number; day: number; frp: number }
const blank = (): Tally => ({ count: 0, lowConf: 0, day: 0, frp: 0 })
const add = (t: Tally, low: boolean, day: boolean, frp: number) => {
  t.count++
  if (low) t.lowConf++
  if (day) t.day++
  t.frp += frp
}

const bySensorYear: Record<string, Record<number, Tally>> = {}
const bySatellite: Record<string, Tally> = {}
const byCentre: Record<string, Tally> = {}
const total = blank()

const rl = createInterface({ input: createReadStream(SRC).pipe(createGunzip()), crlfDelay: Infinity })
let header: string[] | null = null
let col: Record<string, number> = {}

for await (const line of rl) {
  if (!line) continue
  const f = line.split(',')
  if (!header) {
    header = f
    col = Object.fromEntries(f.map((h, i) => [h, i]))
    for (const need of ['sensor', 'satellite', 'acq_date', 'fire_centre', 'low_conf', 'frp', 'daynight'])
      if (!(need in col)) throw new Error(`Missing column ${need} in ${SRC}`)
    continue
  }
  const sensor = f[col.sensor]
  const year = Number(f[col.acq_date].slice(0, 4))
  const low = f[col.low_conf] === 'True'
  const day = f[col.daynight] === 'D'
  const frp = Number(f[col.frp]) || 0
  add(total, low, day, frp)
  add(((bySensorYear[sensor] ??= {})[year] ??= blank()), low, day, frp)
  add((bySatellite[`${sensor} ${f[col.satellite]}`] ??= blank()), low, day, frp)
  add((byCentre[f[col.fire_centre]] ??= blank()), low, day, frp)
}

const round = (t: Tally) => ({ ...t, frp: Math.round(t.frp) })
const summary = {
  source: SRC,
  generatedAt: new Date().toISOString(),
  total: round(total),
  bySensorYear: Object.fromEntries(
    Object.entries(bySensorYear).map(([s, ys]) => [
      s,
      Object.entries(ys)
        .map(([y, t]) => ({ year: Number(y), ...round(t) }))
        .sort((a, b) => a.year - b.year),
    ]),
  ),
  bySatellite: Object.fromEntries(Object.entries(bySatellite).map(([k, t]) => [k, round(t)])),
  byCentre: Object.fromEntries(Object.entries(byCentre).map(([k, t]) => [k, round(t)])),
}

writeFileSync(OUT, JSON.stringify(summary, null, 1) + '\n')
console.log(`Wrote ${OUT}: ${total.count.toLocaleString()} detections`)
