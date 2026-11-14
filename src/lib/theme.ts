import type { FireCentre, Sensor } from './fire.ts'

export const CHART = {
  ember: '#ff6a2b',
  ai: '#a78bfa',
  grid: '#26262a',
  axis: '#38383c',
  muted: '#8a8983',
  surface: '#131316',
}

/** Fixed categorical order (dataviz reference palette, dark steps). Color follows the centre, never its rank. */
export const CENTRE_COLOR: Record<FireCentre, string> = {
  'Cariboo Fire Centre': '#3987e5',
  'Coastal Fire Centre': '#d95926',
  'Kamloops Fire Centre': '#199e70',
  'Northwest Fire Centre': '#c98500',
  'Prince George Fire Centre': '#d55181',
  'Southeast Fire Centre': '#0ca30c',
}

export const SENSOR_COLOR: Record<Sensor, string> = {
  MODIS: '#3987e5',
  VIIRS_SNPP: '#199e70',
}

/** Sequential fire ramp on the dark surface: 0 → surface, 0.6 → ember, 1 → pale flame (lightness rises throughout). */
export const heat = (t: number) => {
  if (t <= 0) return '#1b1b1f'
  const x = Math.min(1, t)
  return x < 0.6
    ? `color-mix(in oklab, #ff6a2b ${Math.round(8 + (x / 0.6) * 92)}%, #1f1b1a)`
    : `color-mix(in oklab, #ffe3a3 ${Math.round(((x - 0.6) / 0.4) * 100)}%, #ff6a2b)`
}

/**
 * Log scale 0..1 for heavily skewed fire counts (one month can be 10,000× another).
 * Values at or below `floor` map to a faint, non-zero step so "some fire" never reads as "none".
 */
export const logScale = (v: number, max: number, floor = 1) => {
  if (v <= 0 || max <= 0) return 0
  if (v <= floor || max <= floor) return 0.03
  return Math.max(0.03, Math.log(v / floor) / Math.log(max / floor))
}

/** Bright fire ramp for map cells on the dark basemap: deep ember → pale flame. */
export const fireRamp = (t: number) => `color-mix(in oklab, #ffe3a3 ${Math.round(Math.min(1, Math.max(0, t)) * 100)}%, #d9481a)`

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US')
export const fmtCompact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n))
export const fmtMW = (n: number) => `${fmtCompact(n)} MW`
