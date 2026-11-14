import type { Building } from './types.ts'

/** Geographic metadata for each monitored site (mock locations for the demo). */
export const SITES: Record<Building, { city: string; country: string; lat: number; lng: number; type: string }> = {
  'Harbor Tower': { city: 'Singapore', country: 'Singapore', lat: 1.2834, lng: 103.8607, type: 'Office high-rise' },
  'Northgate Labs': { city: 'Boston', country: 'United States', lat: 42.3601, lng: -71.0589, type: 'Research laboratory' },
  'Riverside Mall': { city: 'London', country: 'United Kingdom', lat: 51.5072, lng: -0.1276, type: 'Shopping centre' },
  'Summit Hospital': { city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, type: 'Hospital' },
  'Westpark Warehouse': { city: 'Rotterdam', country: 'Netherlands', lat: 51.9244, lng: 4.4777, type: 'Logistics warehouse' },
}
