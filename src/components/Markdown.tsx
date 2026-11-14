import { Fragment, type ReactNode } from 'react'

// Minimal, safe markdown renderer for AI output: ## headings, bullets, numbered lists, **bold**, _italic_.
// It builds React elements (no innerHTML), so model output can't inject markup.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-ink font-semibold">{part.slice(2, -2)}</strong>
    if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) return <em key={i} className="text-muted">{part.slice(1, -1)}</em>
    return <Fragment key={i}>{part}</Fragment>
  })
}

export function Markdown({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={blocks.length} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1.5 marker:text-ember/70`}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Tag>,
    )
    list = null
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const ul = line.match(/^\s*[-*]\s+(.*)/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/)
    if (ul || ol) {
      const ordered = !!ol
      if (list && list.ordered !== ordered) flush()
      list ??= { ordered, items: [] }
      list.items.push((ul ?? ol)![1])
      continue
    }
    flush()
    if (!line.trim()) continue
    const h = line.match(/^#{1,4}\s+(.*)/)
    if (h)
      blocks.push(
        <h4 key={blocks.length} className="text-[11px] uppercase tracking-wider font-semibold text-ember-2 mt-5 first:mt-0 mb-2">
          {h[1]}
        </h4>,
      )
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>)
  }
  flush()
  return <div className={`space-y-2.5 text-sm leading-relaxed text-ink-2 ${streaming ? 'streaming' : ''}`}>{blocks}</div>
}
