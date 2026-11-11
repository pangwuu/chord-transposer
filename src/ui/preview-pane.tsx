import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  blockHeight,
  HEADING_SIZE,
  layoutStatus,
  lineGapBelow,
  SECTION_LEAD_IN,
  type PdfBlock,
  type PdfDocument,
  type PdfMeasure,
  type PdfPage,
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
  const paneWidth = usePaneWidth(scrollRef)

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
        {layout.pages.map((page, index) => (
          <PaperPage
            key={page.pageLabel}
            page={page}
            layout={layout}
            scale={pageScale(paneWidth, page.width)}
            label={`Page ${index + 1}`}
          />
        ))}
      </div>
    </aside>
  )
}

export function usePaneWidth(ref: RefObject<HTMLElement | null>) {
  const [paneWidth, setPaneWidth] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const update = () => setPaneWidth(node.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return paneWidth
}

export function pageScale(paneWidth: number, pageWidth: number) {
  return paneWidth > 0 ? Math.min(1, (paneWidth - 24) / pageWidth) : 1
}

export function PaperPage({
  page,
  layout,
  scale,
  label,
}: {
  page: PdfPage
  layout: PdfDocument
  scale: number
  label: string
}) {
  return (
    <div>
      <p className="meta" style={{ textAlign: 'center' }}>
        {label}
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
            zoom: scale,
          }}
        >
          {page.runningHeader ? (
            <p className="run">
              <strong>{page.runningHeader}</strong>
              {page.meta ? ` ${page.meta}` : ''}
            </p>
          ) : (
            <>
              <h2>{page.title}</h2>
              {page.artist && <p>{page.artist}</p>}
              {(page.meta || page.capoLabel) && (
                <p>
                  {page.meta}
                  {page.capoLabel ? ` ${page.capoLabel}` : ''}
                </p>
              )}
              {page.order && <p>{page.order}</p>}
            </>
          )}
          <div className="rule" />
          <PreviewBody
            blocks={page.blocks}
            columnCount={page.columnCount}
            fontSize={layout.fontSize}
            spacing={layout.spacing}
            measure={{
              lineSpacing: layout.lineSpacing,
              sectionLeadIn: layout.sectionLeadIn,
              headingSize: layout.headingSize,
            }}
            showColumnDivider={layout.showColumnDivider}
            showSectionDivider={layout.showSectionDivider}
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
}

export function BlankPaper({
  width,
  height,
  scale,
  label,
}: {
  width: number
  height: number
  scale: number
  label: string
}) {
  return (
    <div>
      <p className="meta" style={{ textAlign: 'center' }}>
        {label}
      </p>
      <article
        className="paper"
        style={{ width: width * scale, height: height * scale }}
      />
    </div>
  )
}

function PreviewBody({
  blocks,
  columnCount,
  fontSize,
  spacing,
  measure,
  showColumnDivider,
  showSectionDivider,
}: {
  blocks: PdfBlock[]
  columnCount: 1 | 2
  fontSize: number
  spacing: number
  measure: PdfMeasure
  showColumnDivider: boolean
  showSectionDivider: boolean
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
            measure={measure}
            showSectionDivider={showSectionDivider}
          />
        ))}
      </div>
    )
  const left = blocks.filter((block) => block.column !== 2)
  const right = blocks.filter((block) => block.column === 2)
  return (
    <div className={showColumnDivider ? 'columns' : 'columns no-divider'}>
      <div>
        {left.map((block, index) => (
          <PreviewBlock
            key={index}
            block={block}
            fontSize={fontSize}
            spacing={spacing}
            measure={measure}
            showSectionDivider={showSectionDivider}
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
            measure={measure}
            showSectionDivider={showSectionDivider}
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
  measure,
  showSectionDivider,
}: {
  block: PdfBlock
  fontSize: number
  spacing: number
  measure: PdfMeasure
  showSectionDivider: boolean
}) {
  const height = blockHeight(block, fontSize, spacing, measure)
  if (block.kind === 'section')
    return (
      <div
        className={showSectionDivider ? 'section-rule' : 'section-rule plain'}
        style={{
          height,
          fontSize: measure.headingSize ?? HEADING_SIZE,
          paddingTop: (measure.sectionLeadIn ?? SECTION_LEAD_IN) * spacing,
        }}
      >
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
  const lineGap = lineGapBelow(block, fontSize, spacing, measure)
  const chordGap = block.chords.length
    ? Math.max(0, height - lineGap - fontSize * 2)
    : 0
  return (
    <div
      style={{
        height,
        fontSize,
        fontFamily: 'JetBrains Mono, monospace',
        lineHeight: 1,
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
      {chordGap > 0 && <div style={{ height: chordGap }} />}
      <div style={{ whiteSpace: 'pre' }}>{block.text}</div>
    </div>
  )
}
