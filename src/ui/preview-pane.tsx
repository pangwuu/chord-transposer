import type { PdfDocument } from '../domain/pdf-layout'

export function PreviewPane({ layout, onExport }: { layout: PdfDocument; onExport: () => void }) {
  const scale = 0.62
  return (
    <aside className="preview">
      <div className="preview-bar">
        <strong>Preview</strong>
        <span className="meta">{layout.pages.length} {layout.pages.length === 1 ? 'page' : 'pages'}</span>
        <span className="grow" />
        <button className="primary" type="button" onClick={onExport}>Export PDF</button>
      </div>
      <div className="preview-scroll">
        {layout.pages.map((page, index) => (
          <div key={page.pageLabel}>
            <p className="meta" style={{ textAlign: 'center' }}>Page {index + 1}</p>
            <article className="paper" style={{ width: page.width * scale, height: page.height * scale }}>
              <div className="paper-inner" style={{ width: page.width, height: page.height, transform: `scale(${scale})` }}>
                {page.runningHeader ? <p className="run"><strong>{page.runningHeader}</strong> {page.meta}</p> : (
                  <>
                    <h2>{page.title}</h2>
                    {page.artist && <p>{page.artist}</p>}
                    <p>{page.meta} {page.capoLabel ? ` ${page.capoLabel}` : ''}</p>
                    {page.order && <p>{page.order}</p>}
                  </>
                )}
                <div className="rule" />
                {page.blocks.map((block, blockIndex) => {
                  if (block.kind === 'section') return <div className="section-rule" key={blockIndex}>{block.label}</div>
                  if (block.kind === 'comment' || block.kind === 'pointer') return <p key={blockIndex}><em>{block.text}</em></p>
                  if (block.kind === 'bars') return <p key={blockIndex} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{block.text}</p>
                  return (
                    <div key={blockIndex}>
                      <div style={{ position: 'relative', height: block.chords.length ? 16 : 0, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                        {block.chords.map((chord, chordIndex) => <span key={chordIndex} className={chord.invalid ? 'invalid' : ''} style={{ position: 'absolute', left: `${chord.index}ch` }}>{chord.label}</span>)}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre' }}>{block.text}</div>
                    </div>
                  )
                })}
                <p>{page.cue}</p>
                <p><strong>{page.pageLabel}</strong></p>
              </div>
            </article>
          </div>
        ))}
      </div>
    </aside>
  )
}
