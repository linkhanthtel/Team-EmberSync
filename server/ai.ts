// Vite plugin that adds AI endpoints to the dev/preview server:
//   GET  /api/ai/status     → { live: boolean, model }
//   POST /api/ai/summarize  → streamed markdown briefing (text/plain chunks)
//   POST /api/ai/search     → { filters, interpretation, mode }
// The Anthropic API key stays on the server — it is never sent to the browser.
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { Connect, Plugin } from 'vite'
import { z } from 'zod'
import { applyFilters, digest } from '../src/lib/analytics.ts'
import { demoBriefing, demoParseQuery } from '../src/lib/demoAi.ts'
import {
  ALARM_TYPES,
  BUILDINGS,
  EMPTY_FILTERS,
  SEVERITIES,
  STATUSES,
  type AiMode,
  type AlarmDataset,
  type Filters,
  type SearchResult,
} from '../src/lib/types.ts'

const MODEL = 'claude-opus-5-5'
// Server-side refusal fallback: if a request is declined, the API re-runs it on a fallback model.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

const dataset: AlarmDataset = JSON.parse(readFileSync(new URL('../src/data/alarms.json', import.meta.url), 'utf8'))
const today = dataset.rangeEnd.slice(0, 10)

const FilterSchema = z.object({
  interpretation: z.string().describe('One sentence, plain English, describing what is being shown.'),
  buildings: z.array(z.enum(BUILDINGS)),
  types: z.array(z.enum(ALARM_TYPES)),
  severities: z.array(z.enum(SEVERITIES)),
  statuses: z.array(z.enum(STATUSES)),
  floors: z.array(z.number().int()),
  dateFrom: z.string().nullable().describe('YYYY-MM-DD inclusive, or null'),
  dateTo: z.string().nullable().describe('YYYY-MM-DD inclusive, or null'),
  hourFrom: z.number().int().nullable().describe('0-23 UTC; may be greater than hourTo to wrap past midnight'),
  hourTo: z.number().int().nullable(),
  minResponseSec: z.number().nullable(),
  text: z.string().nullable().describe('Free-text keywords matched against zone, device id, notes and responder'),
  sortBy: z.enum(['newest', 'oldest', 'slowest_response']),
})

const SEARCH_SYSTEM = `You translate natural-language questions about a fire alarm event log into structured filters.

Dataset: ${dataset.events.length} events from ${dataset.rangeStart.slice(0, 10)} to ${today} (today is ${today}; all times UTC).
Buildings (location) and zones:
- Harbor Tower (Singapore, 32 floors): Lobby, Office Wing A, Office Wing B, Plant Room, Parking
- Northgate Labs (Boston, USA, 6 floors): Chem Lab, Clean Room, Server Room, Storage, Loading Bay
- Riverside Mall (London, UK, 4 floors): Food Court, Retail North, Retail South, Cinema, Car Park
- Summit Hospital (Sydney, Australia, 9 floors): ICU, Kitchen, Radiology, Ward East, Ward West, Boiler Room
- Westpark Warehouse (Rotterdam, Netherlands, 2 floors): Racking A, Racking B, Battery Charging, Dispatch
Map cities, countries and regions (e.g. "Europe", "APAC") to the matching buildings.
Alarm types: ${ALARM_TYPES.join(', ')}. Severities: ${SEVERITIES.join(', ')}. Statuses: ${STATUSES.join(', ')}.

Rules:
- Empty arrays and nulls mean "no constraint". Only constrain what the user actually asked for.
- "Open" or "unresolved" means statuses Active and Acknowledged.
- "Fire alarms" in general means any alarm; only use type Fire for actual or confirmed fires.
- Map zone names and keywords to \`text\`.
- "Night" or "after hours" means hourFrom 22, hourTo 5.
- "Slow response" means sortBy slowest_response, plus minResponseSec 600 unless the user asks only for a ranking.
- Resolve relative dates against today (${today}).`

const SUMMARY_SYSTEM = `You are a fire safety operations analyst writing a briefing for a facilities manager.
You receive a JSON digest of fire alarm events (counts, response times in seconds, hotspots, open and critical events).
Write a concise markdown briefing using these sections: "## Situation overview" (2-3 sentences), "## Key findings" (4-6 bullets with specific numbers), "## Risks & anomalies" (2-4 bullets), and "## Recommended actions" (3-5 numbered, concrete steps).
Bold the important figures. Use only ## headings, bullets, numbered lists and **bold**. No tables. Stay under 300 words. Don't invent data that isn't in the digest; give response times in minutes and seconds.`

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function errorMessage(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return 'Invalid Anthropic API key.'
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited by the Anthropic API — try again shortly.'
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API.'
  if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status}: ${err.message}`
  return err instanceof Error ? err.message : String(err)
}

export function aiPlugin(apiKey: string | undefined): Plugin {
  const client = apiKey ? new Anthropic({ apiKey }) : null
  const resolveMode = (requested: AiMode | undefined): AiMode => (client && requested !== 'demo' ? 'live' : 'demo')

  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    const url = req.url ?? ''
    if (!url.startsWith('/api/ai/')) return next()

    try {
      if (url === '/api/ai/status' && req.method === 'GET') {
        return json(res, 200, { live: !!client, model: MODEL })
      }

      if (url === '/api/ai/search' && req.method === 'POST') {
        const { query, mode } = await readBody(req)
        if (typeof query !== 'string' || !query.trim()) return json(res, 400, { error: 'query is required' })
        const m = resolveMode(mode)

        if (m === 'demo') {
          await sleep(500) // let the UI's "thinking" state show
          return json(res, 200, { ...demoParseQuery(query, today), mode: m } satisfies SearchResult)
        }

        const msg = await client!.beta.messages.parse({
          model: MODEL,
          max_tokens: 4000,
          ...FALLBACK,
          system: SEARCH_SYSTEM,
          output_config: { effort: 'low', format: betaZodOutputFormat(FilterSchema) },
          messages: [{ role: 'user', content: query.slice(0, 500) }],
        })
        if (msg.stop_reason === 'refusal' || !msg.parsed_output) {
          return json(res, 422, { error: 'Claude could not interpret that query. Try rephrasing it.' })
        }
        const { interpretation, ...rest } = msg.parsed_output
        const filters: Filters = { ...EMPTY_FILTERS, ...rest }
        return json(res, 200, { filters, interpretation, mode: m } satisfies SearchResult)
      }

      if (url === '/api/ai/summarize' && req.method === 'POST') {
        const { filters, mode } = await readBody(req)
        const events = applyFilters(dataset.events, { ...EMPTY_FILTERS, ...filters })
        const m = resolveMode(mode)
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('X-AI-Mode', m)
        res.setHeader('Cache-Control', 'no-cache')

        if (m === 'demo') {
          // Simulate token streaming so the UI behaves the same in both modes.
          for (const tok of demoBriefing(events).match(/\S+\s*/g) ?? []) {
            if (res.destroyed) return
            res.write(tok)
            await sleep(18)
          }
          return res.end()
        }

        const stream = client!.beta.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          ...FALLBACK,
          system: SUMMARY_SYSTEM,
          output_config: { effort: 'medium' },
          messages: [
            {
              role: 'user',
              content: `Digest of ${events.length} filtered events (active filters: ${JSON.stringify(filters ?? {})}):\n\n${JSON.stringify(digest(events))}`,
            },
          ],
        })
        req.on('close', () => stream.abort())
        try {
          for await (const ev of stream) {
            if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') res.write(ev.delta.text)
          }
          const final = await stream.finalMessage()
          if (final.stop_reason === 'refusal') res.write('\n\n_Claude declined to complete this briefing._')
        } catch (err) {
          if (!res.destroyed) res.write(`\n\n**Error:** ${errorMessage(err)}`)
        }
        return res.end()
      }

      return json(res, 404, { error: 'Not found' })
    } catch (err) {
      console.error('[ai]', err)
      if (!res.headersSent) return json(res, 500, { error: errorMessage(err) })
      res.end()
    }
  }

  return {
    name: 'ember-ai',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}
