import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CornerDownLeft, History, Search, Sparkles, Wand2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { aiSearch } from '../lib/ai.ts'
import { applyFilters, countBy } from '../lib/analytics.ts'
import { SEV_COLOR, dateTime } from '../lib/theme.ts'
import { SEVERITIES, type AiMode, type AlarmEvent, type SearchResult } from '../lib/types.ts'
import { describeFilters } from './FilterBar.tsx'
import { SeverityBadge } from './EventsTable.tsx'

const SUGGESTIONS = [
  'Critical alarms at Summit Hospital in the last 30 days',
  'Open alarms that still need attention',
  'Critical events in Europe this month',
  'Overnight smoke alarms with slow response',
  'False alarms in the Riverside Mall food court',
  'CO and heat events in Westpark battery charging',
  'Confirmed fires this month',
]

const THINKING = ['Understanding your question…', 'Mapping buildings, zones & alarm types…', 'Resolving dates and times…', 'Building filters…']
const RECENT_KEY = 'ember.recentSearches'

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}
function saveRecent(q: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...loadRecent().filter((x) => x !== q)].slice(0, 4)))
  } catch {
    /* storage unavailable */
  }
}

export function AiSearch({
  open,
  onClose,
  mode,
  events,
  onApply,
  onSummarize,
}: {
  open: boolean
  onClose: () => void
  mode: AiMode
  events: AlarmEvent[]
  onApply: (r: SearchResult) => void
  onSummarize: (r: SearchResult) => void
}) {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const [lastQuery, setLastQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      setRecent(loadRecent())
      setTimeout(() => inputRef.current?.focus(), 30)
    } else abortRef.current?.abort()
  }, [open])

  useEffect(() => {
    if (phase !== 'thinking') return
    setStep(0)
    const t = setInterval(() => setStep((s) => Math.min(s + 1, THINKING.length - 1)), 650)
    return () => clearInterval(t)
  }, [phase])

  const matches = useMemo(() => (result ? applyFilters(events, result.filters) : []), [result, events])
  const sevDist = useMemo(() => countBy(matches, (e) => e.severity, SEVERITIES), [matches])

  async function submit(q = query) {
    const text = q.trim()
    if (!text) return
    if (phase === 'done' && text === lastQuery && result) return apply()
    setQuery(text)
    setLastQuery(text)
    setPhase('thinking')
    setResult(null)
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const r = await aiSearch(text, mode, ac.signal)
      setResult(r)
      setPhase('done')
      saveRecent(text)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message)
      setPhase('error')
    }
  }

  function apply() {
    if (result) onApply(result)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="AI search"
            initial={{ y: -12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            data-busy={phase === 'thinking'}
            className="ai-ring relative w-full max-w-2xl rounded-2xl bg-surface/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
              className="flex items-center gap-3 px-5 border-b border-line"
            >
              <Sparkles className={`size-5 shrink-0 ${phase === 'thinking' ? 'text-ember animate-pulse' : 'text-ember-2'}`} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about your alarms in plain English…"
                className="flex-1 bg-transparent py-5 text-base outline-none placeholder:text-muted"
              />
              {query && (
                <button type="button" onClick={() => (setQuery(''), setPhase('idle'), setResult(null), inputRef.current?.focus())} className="p-1 text-muted hover:text-ink" aria-label="Clear">
                  <X className="size-4" />
                </button>
              )}
              <kbd className="hidden sm:flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted">
                <CornerDownLeft className="size-3" /> enter
              </kbd>
            </form>

            <div className="max-h-[60vh] overflow-y-auto">
              {/* Idle: suggestions */}
              {phase === 'idle' && (
                <div className="p-3">
                  {recent.length > 0 && (
                    <Group label="Recent">
                      {recent.map((s) => (
                        <Suggestion key={s} icon={History} text={s} onClick={() => submit(s)} />
                      ))}
                    </Group>
                  )}
                  <Group label="Try asking">
                    {SUGGESTIONS.map((s) => (
                      <Suggestion key={s} icon={Search} text={s} onClick={() => submit(s)} />
                    ))}
                  </Group>
                </div>
              )}

              {/* Thinking */}
              {phase === 'thinking' && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Wand2 className="size-4 text-ember animate-bounce" />
                    <AnimatePresence mode="wait">
                      <motion.span key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="ai-text font-medium">
                        {THINKING[step]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  {[85, 60, 72].map((w, i) => (
                    <div key={i} className="shimmer h-3 rounded" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}

              {phase === 'error' && (
                <div className="p-6 text-sm">
                  <p className="text-[#ff8a8d]">{error}</p>
                  <button className="mt-3 text-ember-2 hover:underline" onClick={() => submit()}>
                    Try again
                  </button>
                </div>
              )}

              {/* Result */}
              {phase === 'done' && result && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-5">
                  <div className="flex gap-3">
                    <div className="size-7 shrink-0 rounded-lg bg-gradient-to-br from-ember to-ai grid place-items-center">
                      <Sparkles className="size-3.5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-ink leading-relaxed">{result.interpretation}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {describeFilters(result.filters).map((c, i) => (
                          <motion.span
                            key={c.label}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.05 * i }}
                            className="rounded-md bg-white/5 border border-line px-2 py-0.5 text-[11px] text-ink-2"
                          >
                            {c.label}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-bg/40">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm">
                        <span className="text-xl font-semibold tabular">{matches.length}</span>
                        <span className="text-muted ml-1.5">matching events</span>
                      </span>
                      {/* Severity mix: thin stacked bar with a labelled legend */}
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex h-1.5 w-40 overflow-hidden rounded-full bg-surface-2 gap-px">
                          {sevDist.filter((d) => d.value).map((d) => (
                            <div key={d.name} style={{ flex: d.value, background: SEV_COLOR[d.name] }} title={`${d.name}: ${d.value}`} />
                          ))}
                        </div>
                        <div className="flex gap-2 text-[10px] text-muted">
                          {sevDist.filter((d) => d.value).map((d) => (
                            <span key={d.name}>
                              {d.name} {d.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {matches.slice(0, 5).map((e, i) => (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.04 }}
                        className="flex items-center gap-3 px-4 py-2.5 border-t border-line text-xs"
                      >
                        <SeverityBadge s={e.severity} />
                        <span className="text-ink-2 truncate flex-1">
                          {e.type} · {e.building}, F{e.floor} {e.zone}
                        </span>
                        <span className="text-muted tabular whitespace-nowrap">{dateTime(e.timestamp)}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={apply}
                      className="inline-flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-black hover:bg-ember-2 transition-colors"
                    >
                      Apply to dashboard <ArrowRight className="size-4" />
                    </button>
                    <button
                      onClick={() => {
                        onSummarize(result)
                        onClose()
                      }}
                      disabled={!matches.length}
                      className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm text-ink hover:bg-white/10 disabled:opacity-40"
                    >
                      <Sparkles className="size-4 text-ai" /> Apply & summarize
                    </button>
                    <span className="ml-auto text-[11px] text-muted">{result.mode === 'live' ? 'Interpreted by Claude' : 'Demo parser'}</span>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted">{label}</div>
      {children}
    </div>
  )
}

function Suggestion({ icon: Icon, text, onClick }: { icon: typeof Search; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-ink-2 hover:bg-white/5 hover:text-ink">
      <Icon className="size-4 text-muted group-hover:text-ember-2" />
      <span className="flex-1">{text}</span>
      <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 text-muted" />
    </button>
  )
}
