import { useEffect, useRef, useState } from 'react'
import {
  blockHeight,
  layoutStatus,
  type PdfBlock,
  type PdfDocument,
} from '../domain/pdf-layout'

export function PreviewPane({
  layout,
  onExport,
  onBack,
}: {
  layout: PdfDocument
  onExport: () => void
  onBack?: () => void
}) {
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
        {onBack && (
          <button className="text-button" type="button" onClick={onBack}>
            Back
          </button>
        )}
        <span className="meta">{layoutStatus(layout)}</span>
        <span className="grow" />
        <button className="primary" type="button" onClick={onExport}>
          Export PDF
        </button>
      </div>
      {layout.fitWarning && <p className="fit-warning">{layout.fitWarning}</p>}
      <div className="preview-scroll" ref={scrollRef}>
        {layout.pages.map((page, index) => {
          const scale = paneWidth > 0 ? Math.min(1, (paneWidth - 24) / page.width) : 1
          return (
            <div key={page.pageLabel}>
              <p className="meta" style={{ textAlign: 'center' }}>
                Page {index + 1}
              </p>
              <article
                className="paper"
                style={{
                  width: page.width * scale,
                  height: page.height * scale,
                }}
              >
                <div
                  className="paper-inner"
                  style={{
                    width: page.width,
                    height: page.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  {page.runningHeader ? (
                    <p className="run">
                      <strong>{page.runningHeader}</strong> {page.meta}
                    </p>
                  ) : (
                    <>
                      <h2>{page.title}</h2>
                      {page.artist && <p>{page.artist}</p>}
                      <p>
                        {page.meta} {page.capoLabel ? ` ${page.capoLabel}` : ''}
                      </p>
                      {page.order && <p>{page.order}</p>}
                    </>
                  )}
                  <div className="rule" />
                  <PreviewBody
                    blocks={page.blocks}
                    columnCount={page.columnCount}
                    fontSize={layout.fontSize}
                    spacing={layout.spacing}
                  />
                  <div className="paper-foot">
                    <p>{page.cue}</p>
                    <p>
                      <strong>{page.pageLabel}</strong>
                    </p>
                  </div>
                </div>
              </article>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function PreviewBody({
  blocks,
  columnCount,
  fontSize,
  spacing,
}: {
  blocks: PdfBlock[]
  columnCount: 1 | 2
  fontSize: number
  spacing: number
}) {
  if (columnCount === 1)
    return (
      <div>
        {blocks.map((block, index) => (
          <PreviewBlock
            key={index}
            block={block}
            fontSize={fontSize}
            spacing={spacing}
          />
        ))}
      </div>
    )
  const left = blocks.filter((block) => block.column !== 2)
  const right = blocks.filter((block) => block.column === 2)
  return (
    <div className="columns">
      <div>
        {left.map((block, index) => (
          <PreviewBlock
            key={index}
            block={block}
            fontSize={fontSize}
            spacing={spacing}
          />
        ))}
      </div>
      <div>
        {right.map((block, index) => (
          <PreviewBlock
            key={index}
            block={block}
            fontSize={fontSize}
            spacing={spacing}
          />
        ))}
      </div>
    </div>
  )
}

function PreviewBlock({
  block,
  fontSize,
  spacing,
}: {
  block: PdfBlock
  fontSize: number
  spacing: number
}) {
  const height = blockHeight(block, fontSize, spacing)
  if (block.kind === 'section')
    return (
      <div className="section-rule" style={{ height }}>
        {block.label}
      </div>
    )
  if (block.kind === 'comment' || block.kind === 'pointer')
    return (
      <p style={{ height, margin: 0 }}>
        <em>{block.text}</em>
      </p>
    )
  if (block.kind === 'bars')
    return (
      <p
        style={{
          height,
          margin: 0,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize,
          fontWeight: 800,
          whiteSpace: 'pre',
        }}
      >
        {block.text}
      </p>
    )
  return (
    <div
      style={{
        height,
        fontSize,
        fontFamily: 'JetBrains Mono, monospace',
        lineHeight: 1.05,
      }}
    >
      <div
        style={{
          position: 'relative',
          height: block.chords.length ? fontSize : 0,
          fontWeight: 800,
        }}
      >
        {block.chords.map((chord, chordIndex) => (
          <span
            key={chordIndex}
            className={chord.invalid ? 'invalid' : ''}
            style={{ position: 'absolute', left: `${chord.index}ch` }}
          >
            {chord.label}
          </span>
        ))}
      </div>
      <div style={{ whiteSpace: 'pre' }}>{block.text}</div>
    </div>
  )
}
