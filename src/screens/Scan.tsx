import { ChartCard, SensorYears } from '../components/charts.tsx'
import { Note, StatTiles } from '../components/ui.tsx'
import { CANADA_RAW_DETECTIONS, FIRMS } from '../lib/fire.ts'
import { fmtCompact, fmtInt } from '../lib/theme.ts'

const SAT_LABEL: Record<string, string> = { 'MODIS Terra': 'MODIS · Terra', 'MODIS Aqua': 'MODIS · Aqua', 'VIIRS_SNPP N': 'VIIRS · Suomi-NPP' }

export function Scan() {
  const t = FIRMS.total
  const modis = FIRMS.bySensorYear.MODIS.reduce((s, d) => s + d.count, 0)
  const viirs = FIRMS.bySensorYear.VIIRS_SNPP.reduce((s, d) => s + d.count, 0)
  const pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1)}%`

  return (
    <>
      <StatTiles
        tiles={[
          { label: 'Canada detections', value: fmtCompact(CANADA_RAW_DETECTIONS), sub: 'FIRMS yearly archive, 2001–2025' },
          { label: 'BC vegetation fires', value: fmtCompact(t.count), sub: `${pct(t.count, CANADA_RAW_DETECTIONS)} of Canada, after cleaning` },
          { label: 'MODIS detections', value: fmtCompact(modis), sub: '2001–2025, Terra + Aqua' },
          { label: 'VIIRS detections', value: fmtCompact(viirs), sub: '2012–2025, Suomi-NPP' },
          { label: 'Low confidence kept', value: fmtCompact(t.lowConf), sub: `${pct(t.lowConf, t.count)} flagged, not dropped` },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <ChartCard title="BC detections per year, by sensor" subtitle="Raw cleaned detections from bc_firms_clean_2001_2025.csv.gz (not harmonised)">
            <SensorYears data={FIRMS.bySensorYear} />
          </ChartCard>
        </div>
        <ChartCard title="By satellite" subtitle="Share of all cleaned BC detections">
          <ul className="space-y-3">
            {Object.entries(FIRMS.bySatellite)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([k, v]) => (
                <li key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-2">{SAT_LABEL[k] ?? k}</span>
                    <span className="tabular text-ink font-medium">{fmtInt(v.count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full bg-ember" style={{ width: `${(v.count / t.count) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-muted mt-1 tabular">
                    {pct(v.day, v.count)} day passes · {pct(v.lowConf, v.count)} low confidence
                  </div>
                </li>
              ))}
          </ul>
        </ChartCard>
      </div>

      <Note>
        <p>
          <strong>How we scanned.</strong> We started from the NASA FIRMS yearly country archive for Canada: MODIS Collection 6.1 (2001–2025) and VIIRS Suomi-NPP 375 m
          (2012–2025), {fmtInt(CANADA_RAW_DETECTIONS)} detections in all.
        </p>
        <p>
          We kept vegetation fires only (FIRMS type 0), clipped to British Columbia, tagged each point with its fire centre, flagged low-confidence points instead of dropping
          them, and snapped each point to a 0.1° grid cell. That leaves {fmtInt(t.count)} detections.
        </p>
        <p>
          <strong>Why now.</strong> The MODIS missions are ending and Suomi-NPP science data closed in November 2026. VIIRS sees about five times more hotspots than MODIS
          over the same fires, so a 25-year record only reads as one calendar once the two sensors are put on one scale. That is the job of the Block move.
        </p>
      </Note>
    </>
  )
}
