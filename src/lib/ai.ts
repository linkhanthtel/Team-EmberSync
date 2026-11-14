// Browser-side client for the /api/ai/* endpoints.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiMode, Filters, SearchResult } from './types.ts'

export function useAiStatus() {
  const [status, setStatus] = useState<{ live: boolean; model: string } | null>(null)
  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json() as Promise<{ live: boolean; model: string }>)
      .then(setStatus)
      .catch(() => setStatus({ live: false, model: '' }))
  }, [])
  return status
}

export async function aiSearch(query: string, mode: AiMode, signal?: AbortSignal): Promise<SearchResult> {
  const res = await fetch('/api/ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, mode }),
    signal,
  })
  const body = (await res.json()) as SearchResult & { error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Search failed')
  return body
}

export function useBriefing() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [usedMode, setUsedMode] = useState<AiMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (filters: Filters, mode: AiMode) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setText('')
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, mode }),
        signal: ac.signal,
      })
      if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Briefing failed')
      setUsedMode(res.headers.get('X-AI-Mode') as AiMode)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        setText((t) => t + decoder.decode(value, { stream: true }))
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      if (abortRef.current === ac) setBusy(false)
    }
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setBusy(false)
  }, [])

  return { text, busy, error, usedMode, run, stop }
}
