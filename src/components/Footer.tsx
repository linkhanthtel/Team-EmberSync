import { Satellite } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line pt-6 pb-8">
      <div className="flex flex-col md:flex-row gap-4 md:items-start md:justify-between">
        <div className="flex gap-3 max-w-2xl">
          <div className="size-8 shrink-0 rounded-lg border border-ember/30 bg-ember/10 grid place-items-center">
            <Satellite className="size-4 text-ember-2" />
          </div>
          <div className="text-xs leading-relaxed text-muted">
            <p className="text-ink-2 font-medium mb-1">Data: NASA FIRMS, 2001–2025.</p>
            <p>
              MODIS Collection 6.1 and VIIRS Suomi-NPP 375 m active fire detections, cleaned to BC vegetation fires and harmonised onto one calendar. We acknowledge the use of
              data and imagery from LANCE FIRMS operated by NASA's Earth Science Data and Information System (ESDIS). Place names:{' '}
              <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline hover:text-ink-2">
                GeoNames
              </a>
              , CC BY 4.0.
            </p>
          </div>
        </div>
        <div className="text-xs text-muted md:text-right shrink-0">
          <p className="mt-1">Team EmberSync · NASA Space Apps Challenge 2026</p>
        </div>
      </div>
    </footer>
  )
}
