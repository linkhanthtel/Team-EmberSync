// Shared between the browser app and the Vite AI middleware (server/ai.ts).

export const BUILDINGS = [
  'Harbor Tower',
  'Northgate Labs',
  'Riverside Mall',
  'Summit Hospital',
  'Westpark Warehouse',
] as const

export const ALARM_TYPES = ['Fire', 'Smoke', 'Heat', 'CO', 'Fault', 'False Alarm', 'Test'] as const
export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const
export const STATUSES = ['Active', 'Acknowledged', 'Resolved'] as const
export const DEVICE_TYPES = [
  'Smoke Detector',
  'Heat Detector',
  'Manual Call Point',
  'CO Sensor',
  'Sprinkler Flow Switch',
  'Control Panel',
] as const

export type Building = (typeof BUILDINGS)[number]
export type AlarmType = (typeof ALARM_TYPES)[number]
export type Severity = (typeof SEVERITIES)[number]
export type Status = (typeof STATUSES)[number]
export type DeviceType = (typeof DEVICE_TYPES)[number]

export interface AlarmEvent {
  id: string
  timestamp: string // ISO 8601, UTC
  building: Building
  floor: number
  zone: string
  deviceId: string
  deviceType: DeviceType
  type: AlarmType
  severity: Severity
  status: Status
  responseTimeSec: number | null // null while still Active
  acknowledgedBy: string | null
  notes: string
}

export interface AlarmDataset {
  generatedAt: string
  rangeStart: string
  rangeEnd: string
  events: AlarmEvent[]
}

/** Filters shared by the dashboard UI and AI search. Empty arrays mean "any". */
export interface Filters {
  buildings: Building[]
  types: AlarmType[]
  severities: Severity[]
  statuses: Status[]
  floors: number[]
  dateFrom: string | null // YYYY-MM-DD inclusive
  dateTo: string | null // YYYY-MM-DD inclusive
  hourFrom: number | null // 0-23; wraps past midnight when hourFrom > hourTo
  hourTo: number | null
  minResponseSec: number | null
  text: string | null
  sortBy: 'newest' | 'oldest' | 'slowest_response'
}

export const EMPTY_FILTERS: Filters = {
  buildings: [],
  types: [],
  severities: [],
  statuses: [],
  floors: [],
  dateFrom: null,
  dateTo: null,
  hourFrom: null,
  hourTo: null,
  minResponseSec: null,
  text: null,
  sortBy: 'newest',
}

export interface SearchResult {
  filters: Filters
  interpretation: string
  mode: AiMode
}

export type AiMode = 'live' | 'demo'
