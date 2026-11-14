import { FlaskConical } from 'lucide-react'

export function Footer({ rangeStart, rangeEnd }: { rangeStart: string; rangeEnd: string }) {
  return (
    <footer className="mt-12 border-t border-line pt-6 pb-8">
      <div className="flex flex-col md:flex-row gap-4 md:items-start md:justify-between">
        <div className="flex gap-3 max-w-2xl">
          <div className="size-8 shrink-0 rounded-lg border border-ember/30 bg-ember/10 grid place-items-center">
            <FlaskConical className="size-4 text-ember-2" />
          </div>
          <div className="text-xs leading-relaxed text-muted">
            <p className="text-ink-2 font-medium mb-1">This is a demo project.</p>
            <p>
              All buildings, locations, devices, responders and alarm events are <span className="text-ink-2">simulated</span> ({rangeStart} to {rangeEnd}) and don't represent real
              incidents.
            </p>
          </div>
        </div>
        <div className="text-xs text-muted md:text-right shrink-0">
          <p className="mt-1">© {new Date().getFullYear()} Ember Sync demo</p>
        </div>
      </div>
    </footer>
  )
}
