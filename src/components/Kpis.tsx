import { motion } from 'framer-motion'
import { Activity, AlertTriangle, Flame, Siren, Timer, VolumeX } from 'lucide-react'
import { fmtDuration, kpis } from '../lib/analytics.ts'

export function Kpis({ k }: { k: ReturnType<typeof kpis> }) {
  const tiles = [
    { label: 'Total events', value: k.total.toLocaleString(), icon: Activity, tone: 'text-ink-2' },
    { label: 'Open alarms', value: k.active, icon: Siren, tone: k.active ? 'text-sev-critical' : 'text-ink-2', pulse: k.active > 0 },
    { label: 'Critical', value: k.critical, icon: AlertTriangle, tone: 'text-sev-critical' },
    { label: 'Confirmed fires', value: k.fires, icon: Flame, tone: 'text-ember' },
    { label: 'Avg response', value: fmtDuration(k.avgResponseSec), icon: Timer, tone: 'text-ai' },
    { label: 'False alarm rate', value: `${(k.falseAlarmRate * 100).toFixed(1)}%`, icon: VolumeX, tone: k.falseAlarmRate > 0.2 ? 'text-sev-medium' : 'text-ink-2' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {tiles.map((t, i) => (
        <motion.div
          key={t.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="card px-4 py-3.5"
        >
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="relative flex">
              <t.icon className={`size-3.5 ${t.tone}`} />
              {t.pulse && <span className="absolute inset-0 rounded-full bg-sev-critical/60 animate-ping" />}
            </span>
            {t.label}
          </div>
          <div className="text-2xl font-semibold mt-1.5 tracking-tight">{t.value}</div>
        </motion.div>
      ))}
    </div>
  )
}
