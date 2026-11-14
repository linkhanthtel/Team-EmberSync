import { motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  ariaLabel,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  label: (v: T) => string
  disabled?: (v: T) => boolean
  ariaLabel?: string
}) {
  return (
    <div className="flex rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={value === o}
          disabled={disabled?.(o)}
          onClick={() => onChange(o)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
            value === o ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink-2'
          }`}
        >
          {label(o)}
        </button>
      ))}
    </div>
  )
}

export function StatTiles({ tiles }: { tiles: { label: string; value: ReactNode; sub?: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {tiles.map((t, i) => (
        <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card px-4 py-3.5 min-w-0">
          <div className="text-xs text-muted truncate">{t.label}</div>
          <div className="text-2xl font-semibold mt-1.5 tracking-tight tabular truncate">{t.value}</div>
          {t.sub && <div className="text-[11px] text-muted mt-0.5 truncate">{t.sub}</div>}
        </motion.div>
      ))}
    </div>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="card p-5 text-sm leading-relaxed text-ink-2 space-y-3 [&_strong]:text-ink [&_strong]:font-semibold">{children}</div>
}

/** Resolve a lazy loader once; returns [value | null, error | null]. */
export function useLoaded<T>(load: () => Promise<T>): [T | null, string | null] {
  const [v, setV] = useState<T | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    load().then(
      (x) => live && setV(() => x),
      (e: unknown) => live && setErr(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [load])
  return [v, err]
}

export const selectCls =
  'h-8 rounded-lg border border-line bg-surface px-3 pr-8 text-xs text-ink-2 hover:border-white/20 focus:border-ember/60 outline-none appearance-none bg-no-repeat bg-[right_0.6rem_center] bg-[length:12px] ' +
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a8983' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]"
