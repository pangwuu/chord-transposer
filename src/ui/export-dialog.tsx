import type { PdfContent, PdfDocument, Paper } from '../domain/pdf-layout'

export type PdfChoices = {
  paper: Paper
  fontSize: number
  columns: 1 | 2
  fit: 'auto' | 1 | 2
  content: PdfContent
  repeats: 'full' | 'pointer'
}

export function ExportDialog({
  layout,
  choices,
  onChange,
  onClose,
  onDownload,
}: {
  layout: PdfDocument
  choices: PdfChoices
  onChange: (choices: PdfChoices) => void
  onClose: () => void
  onDownload: () => void
}) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-labelledby="export-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="export-title">Export PDF</h2>
        <div className="properties">
          <span>Paper</span>
          <select className="select" aria-label="Paper" value={choices.paper} onChange={(event) => onChange({ ...choices, paper: event.target.value as Paper })}>
            <option value="a4">A4</option>
            <option value="letter">US Letter</option>
          </select>
          <span>Content</span>
          <select className="select" aria-label="Content" value={choices.content} onChange={(event) => onChange({ ...choices, content: event.target.value as PdfContent })}>
            <option value="full">Full chart</option>
            <option value="chords">Chords only</option>
            <option value="lyrics">Lyrics only</option>
          </select>
          <span>Columns</span>
          <select className="select" aria-label="Columns" value={choices.columns} onChange={(event) => onChange({ ...choices, columns: Number(event.target.value) as 1 | 2 })}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
          <span>Fit</span>
          <select className="select" aria-label="Fit to pages" value={String(choices.fit)} onChange={(event) => onChange({ ...choices, fit: event.target.value === 'auto' ? 'auto' : (Number(event.target.value) as 1 | 2) })}>
            <option value="auto">Auto</option>
            <option value="1">1 page</option>
            <option value="2">2 pages</option>
          </select>
          <span>Lyric size</span>
          <input className="field" aria-label="Lyric size" type="range" min={10} max={16} value={choices.fontSize} onChange={(event) => onChange({ ...choices, fontSize: Number(event.target.value) })} />
          <span>Repeats</span>
          <select className="select" aria-label="Repeats" value={choices.repeats} onChange={(event) => onChange({ ...choices, repeats: event.target.value as 'full' | 'pointer' })}>
            <option value="full">Print in full</option>
            <option value="pointer">Repeat Chorus</option>
          </select>
        </div>
        <p className="meta">{layout.pages.length} {layout.pages.length === 1 ? 'page' : 'pages'} · {layout.fileName}</p>
        <div className="row-meta">
          <button className="text-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary" type="button" onClick={onDownload}>Download</button>
        </div>
      </div>
    </div>
  )
}
