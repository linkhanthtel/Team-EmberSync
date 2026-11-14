# Ember Sync — Fire Alarm Intelligence

A React dashboard for fire alarm data, with AI briefings and natural-language search powered by Claude.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

To use live Claude AI:

```bash
cp .env.example .env.local
# edit .env.local → ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Without a key the app runs in **Demo** mode: a rule-based query parser and a templated briefing with simulated streaming. Use the **Live Claude / Demo** switch at the bottom of the sidebar to change modes.

## Features

- **Responsive side nav**: collapsible icon rail on desktop (remembered between visits), slide-in drawer on mobile, live site status, and hash routes (`#/overview`, `#/map`, `#/events`).
- **Global map**: d3-geo world map of the 5 (simulated) sites, with markers sized by events, critical, open or avg response, pulsing rings for open alarms, region zoom (World/Americas/Europe/APAC), click-to-filter and site cards.
- **Dashboard**: KPI tiles, daily events by severity, alarm types, events by building, weekday × hour heatmap, response time by building and as a weekly trend, and a paginated event log.
- **AI Search (⌘K)**: ask questions such as *"overnight smoke alarms with slow response at the hospital"*. Claude turns the question into structured filters (structured outputs + Zod), shows a preview, then applies them to the whole dashboard.
- **AI Briefing**: a streamed markdown summary of the events in the current filters, covering overview, findings, risks and actions.

## Structure

```
src/data/alarms.json      Mock dataset (regenerate: npm run gen:data)
scripts/generate-data.ts  Seeded generator: 5 buildings, 90 days, ~585 events
src/lib/types.ts          Shared types + Filters model
src/lib/analytics.ts      Filtering & aggregations (shared by UI and server)
src/lib/demoAi.ts         Offline demo AI
src/lib/ai.ts             Browser client for /api/ai/*
server/ai.ts              Vite middleware: /api/ai/status, /search, /summarize
src/lib/sites.ts          Site locations (city, country, lat/lng)
src/components/           Charts, world map, sidebar, footer, AI search, AI briefing, table, filters
```

The AI endpoints run inside the Vite dev/preview server, so the API key never reaches the browser. To move to a real backend later, port `server/ai.ts` to Express or another framework and swap the JSON file for database queries in `analytics.ts`.
