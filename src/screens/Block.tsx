import { useMemo } from 'react'
import { AnnualByCentre, ChartCard, FactorScatter, FireCalendar, fmtMetric } from '../components/charts.tsx'
import { Note, Segmented, StatTiles } from '../components/ui.tsx'
import {
  FACTORS,
  METRIC_LABEL,
  MONTHS,
  YEARS,
  calendarCell,
  fitFactors,
  lowConfOf,
  metricOf,
  rawCountOf,
  ym,
  ymLabel,
  type CentreSel,
  type Metric,
} from '../lib/fire.ts'
import { fmtCompact, fmtInt } from '../lib/theme.ts'

const FIT = fitFactors()

export function Block({
  centre,
  metric,
  onMetric,
  selected,
  onOpenMonth,
}: {
  centre: CentreSel
  metric: Metric
  onMetric: (m: Metric) => void
  selected: string
  onOpenMonth: (ym: string) => void
}) {
  const s = useMemo(() => {
    const cells = YEARS.flatMap((y) => MONTHS.map((_, i) => calendarCell(centre, ym(y, i + 1))))
    const total = cells.reduce((a, c) => a + metricOf(c, metric), 0)
    const peak = cells.reduce((a, c) => (metricOf(c, metric) > metricOf(a, metric) ? c : a))
    const byYear = YEARS.map((y) => ({ y, v: cells.filter((c) => c.year === y).reduce((a, c) => a + metricOf(c, metric), 0) }))
    const topYear = byYear.reduce((a, b) => (b.v > a.v ? b : a))
    const summer = cells.filter((c) => c.month >= 7 && c.month <= 8).reduce((a, c) => a + metricOf(c, metric), 0)
    const raw = cells.reduce((a, c) => a + rawCountOf(c), 0)
    const low = cells.reduce((a, c) => a + lowConfOf(c), 0)
    return { total, peak, topYear, summer, raw, low }
  }, [centre, metric])

  return (
    <>
      <StatTiles
        tiles={[
          { label: `${METRIC_LABEL[metric]}, 2001–2025`, value: metric === 'count' ? fmtCompact(s.total) : `${fmtCompact(s.total)} MW`, sub: 'Harmonised to VIIRS scale' },
          { label: 'Peak month', value: ymLabel(s.peak.ym), sub: fmtMetric(metric, metricOf(s.peak, metric)) },
          { label: 'Busiest year', value: s.topYear.y, sub: `${((s.topYear.v / s.total) * 100).toFixed(0)}% of the 25-year total` },
          { label: 'July + August share', value: `${((s.summer / s.total) * 100).toFixed(0)}%`, sub: 'Of the 25-year total' },
          { label: 'Low confidence', value: `${((s.low / s.raw) * 100).toFixed(1)}%`, sub: `${fmtInt(s.low)} of ${fmtInt(s.raw)} calendar detections` },
        ]}
      />

      <ChartCard
        title="Fire calendar"
        subtitle={`${METRIC_LABEL[metric]} per month · MODIS × ${metric === 'count' ? FACTORS.count : FACTORS.energy} for 2001–2011, VIIRS as observed from 2012`}
        right={<Segmented ariaLabel="Metric" options={['count', 'energy'] as const} value={metric} onChange={onMetric} label={(m) => METRIC_LABEL[m]} />}
      >
        <FireCalendar centre={centre} metric={metric} selected={selected} onSelect={onOpenMonth} />
      </ChartCard>

      <ChartCard title={`${METRIC_LABEL[metric]} per year by fire centre`} subtitle="Harmonised, summed over the twelve months">
        <AnnualByCentre metric={metric} centre={centre} />
      </ChartCard>

      <div>
        <h2 className="text-sm font-semibold mt-2 mb-1">Harmonisation check</h2>
        <p className="text-xs text-muted mb-3">
          Refitted live from the calendar on the overlap years. Published factors: hotspots {FACTORS.count}, fire energy {FACTORS.energy}.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="Hotspot count, VIIRS vs MODIS">
            <FactorScatter
              label="Count"
              k={FIT.count.k}
              r={FIT.count.r}
              unit={fmtInt}
              points={FIT.points.map((p) => ({ centre: p.centre, ym: p.ym, x: p.countModis, y: p.countViirs }))}
            />
          </ChartCard>
          <ChartCard title="Fire energy, VIIRS vs MODIS">
            <FactorScatter
              label="Energy"
              k={FIT.energy.k}
              r={FIT.energy.r}
              unit={(v) => fmtMetric('energy', v)}
              points={FIT.points.map((p) => ({ centre: p.centre, ym: p.ym, x: p.energyModis, y: p.energyViirs }))}
            />
          </ChartCard>
        </div>
      </div>

      <Note>
        <p>
          <strong>Fire energy</strong> is FRP summed per 0.1° cell per day, then rolled up per fire centre per month. It is a monthly sum, not a time-integrated FRE. The
          energy factor below 1 fits Li 2018, who found VIIRS FRP about 47% smaller than MODIS for large boreal fires.
        </p>
      </Note>
    </>
  )
}
