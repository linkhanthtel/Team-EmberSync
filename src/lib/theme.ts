import type { Severity } from './types.ts'

export const SEV_COLOR: Record<Severity, string> = {
  Critical: '#e5484d',
  High: '#ec835a',
  Medium: '#fab219',
  Low: '#6f6e69',
}

export const CHART = {
  ember: '#ff6a2b',
  ai: '#a78bfa',
  grid: '#26262a',
  axis: '#38383c',
  muted: '#8a8983',
  surface: '#131316',
}

/** Sequential ember ramp on the dark surface: 0 → surface, 1 → bright ember. */
export const heat = (t: number) =>
  t <= 0 ? '#1b1b1f' : `color-mix(in oklab, #ff8a4c ${Math.round(18 + t * 82)}%, #1b1b1f)`

export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
