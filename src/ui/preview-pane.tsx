import { useEffect, useRef, useState } from 'react'
import type { PdfDocument } from '../domain/pdf-layout'

export function PreviewPane({ layout, onExport, onBack }: { layout: PdfDocument; onExport: () => void; onBack?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [paneWidth, setPaneWidth] = useState(0)

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const update = () => setPaneWidth(node.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <aside className="preview">
      <div className="preview-bar">
        {onBack && <button className="text-button" type="button" onClick={onBack}>Back</button>}
        <strong>Preview</strong>
        <span className="meta">{layout.pages.length} {layout.pages.length === 1 ? 'page' : 'pages'}</span>
        <span className="grow" />
        <button className="primary" type="button" onClick={onExport}>Export PDF</button>
      </div>
      <div className="preview-scroll" ref={scrollRef}>
        {layout.pages.map((page, index) => {
          const scale = paneWidth > 0 ? Math.min(1, (paneWidth - 24) / page.width) : 1
          return (
            <div key={page.pageLabel}>
              <p className="meta" style={{ textAlign: 'center' }}>Page {index + 1}</p>
              <article className="paper" style={{ width: page.width * scale, height: page.height * scale }}>
                <div className="paper-inner" style={{ width: page.width, height: page.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
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
          )
        })}
      </div>
    </aside>
  )
}
