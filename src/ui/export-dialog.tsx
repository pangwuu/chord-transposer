import { useRef } from 'react'
import {
  HEADING_SIZE,
  SECTION_LEAD_IN,
  layoutStatus,
  type PdfContent,
  type PdfDocument,
  type PdfPage,
  type Paper,
  type SetlistLayout,
} from '../domain/pdf-layout'
import { BlankPaper, PaperPage, pageScale, usePaneWidth } from './preview-pane'

export type PdfChoices = {
  paper: Paper
  fontSize: number
  columns: 1 | 2
  fit: 'auto' | 1 | 2
  content: PdfContent
  repeats: 'full' | 'pointer'
  showArtist: boolean
  showKey: boolean
  showTime: boolean
  chordLyricSpacing: number
  sectionLeadIn: number
  showColumnDivider: boolean
  showSectionDivider: boolean
  headingSize: number
}

export const defaultPdfChoices = (): PdfChoices => ({
  paper: 'a4',
  fontSize: 12,
  columns: 1,
  fit: 'auto',
  content: 'full',
  repeats: 'full',
  showArtist: true,
  showKey: true,
  showTime: true,
  chordLyricSpacing: 1,
  sectionLeadIn: SECTION_LEAD_IN,
  showColumnDivider: true,
  showSectionDivider: true,
  headingSize: HEADING_SIZE,
})

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const paneWidth = usePaneWidth(scrollRef)
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog pdf-export"
        role="dialog"
        aria-labelledby="export-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="export-title">Export PDF</h2>
        <div className="pdf-export-grid">
          <PdfChoiceFields choices={choices} onChange={onChange} />
          <div className="pdf-export-preview" ref={scrollRef}>
            {layout.pages.map((page, index) => (
              <PaperPage
                key={`${page.pageLabel}-${index}`}
                page={page}
                layout={layout}
                scale={pageScale(paneWidth, page.width)}
                label={`Page ${index + 1}`}
              />
            ))}
          </div>
        </div>
        <p className="meta">
          {layoutStatus(layout)} · {layout.fileName}
        </p>
        {layout.fitWarning && (
          <p className="fit-warning">{layout.fitWarning}</p>
        )}
        <div className="row-meta">
          <button className="text-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="button" onClick={onDownload}>
            Download
          </button>
        </div>
      </div>
    </div>
  )
}

export function SetlistExportDialog({
  fileName,
  layout,
  choices,
  rightHand,
  onChange,
  onRightHand,
  onClose,
  onDownload,
}: {
  fileName: string
  layout: SetlistLayout
  choices: PdfChoices
  rightHand: boolean
  onChange: (choices: PdfChoices) => void
  onClose: () => void
  onRightHand: (rightHand: boolean) => void
  onDownload: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const paneWidth = usePaneWidth(scrollRef)
  const pages = previewPages(layout)
  const warnings = layout.sheets.flatMap((sheet) =>
    sheet.kind === 'song' && sheet.layout.fitWarning
      ? [`${sheet.layout.pages[0]?.title ?? 'Song'}: ${sheet.layout.fitWarning}`]
      : [],
  )
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog pdf-export"
        role="dialog"
        aria-labelledby="setlist-export-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="setlist-export-title">Export setlist PDF</h2>
        <div className="pdf-export-grid">
          <div>
            <PdfChoiceFields choices={choices} onChange={onChange} />
            <label className="hint setlist-right-hand">
              <input
                type="checkbox"
                aria-label="Right-hand pages"
                checked={rightHand}
                onChange={(event) => onRightHand(event.target.checked)}
              />
              Right-hand pages
            </label>
          </div>
          <div className="pdf-export-preview" ref={scrollRef}>
            {pages.length === 0 && (
              <p className="meta">Add a song before exporting.</p>
            )}
            {pages.map((item) =>
              item.kind === 'blank' ? (
                <BlankPaper
                  key={item.key}
                  width={item.width}
                  height={item.height}
                  scale={pageScale(paneWidth, item.width)}
                  label={item.label}
                />
              ) : (
                <PaperPage
                  key={item.key}
                  page={item.page}
                  layout={item.layout}
                  scale={pageScale(paneWidth, item.page.width)}
                  label={item.label}
                />
              ),
            )}
          </div>
        </div>
        <p className="meta">
          {layout.pageCount === 1 ? '1 page' : `${layout.pageCount} pages`} · {fileName}
        </p>
        {warnings.map((warning) => (
          <p className="fit-warning" key={warning}>
            {warning}
          </p>
        ))}
        <div className="row-meta">
          <button className="text-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            type="button"
            onClick={onDownload}
            disabled={layout.pageCount === 0}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  )
}

function PdfChoiceFields({
  choices,
  onChange,
}: {
  choices: PdfChoices
  onChange: (choices: PdfChoices) => void
}) {
  return (
    <div className="properties">
      <span>Paper</span>
      <select
        className="select"
        aria-label="Paper"
        value={choices.paper}
        onChange={(event) =>
          onChange({ ...choices, paper: event.target.value as Paper })
        }
      >
        <option value="a4">A4</option>
        <option value="letter">US Letter</option>
      </select>
      <span>Content</span>
      <select
        className="select"
        aria-label="Content"
        value={choices.content}
        onChange={(event) =>
          onChange({
            ...choices,
            content: event.target.value as PdfContent,
          })
        }
      >
        <option value="full">Full chart</option>
        <option value="chords">Chords only</option>
        <option value="lyrics">Lyrics only</option>
      </select>
      <span>Columns</span>
      <select
        className="select"
        aria-label="Columns"
        value={choices.columns}
        onChange={(event) =>
          onChange({
            ...choices,
            columns: Number(event.target.value) as 1 | 2,
          })
        }
      >
        <option value={1}>1</option>
        <option value={2}>2</option>
      </select>
      <span>Fit</span>
      <select
        className="select"
        aria-label="Fit to pages"
        value={String(choices.fit)}
        onChange={(event) =>
          onChange({
            ...choices,
            fit:
              event.target.value === 'auto'
                ? 'auto'
                : (Number(event.target.value) as 1 | 2),
          })
        }
      >
        <option value="auto">Auto</option>
        <option value="1">1 page</option>
        <option value="2">2 pages</option>
      </select>
      <span>Lyric size</span>
      <input
        className="field"
        aria-label="Lyric size"
        type="range"
        min={10}
        max={16}
        value={choices.fontSize}
        onChange={(event) =>
          onChange({ ...choices, fontSize: Number(event.target.value) })
        }
      />
      <span>Heading size</span>
      <label className="choice-slider">
        <input
          aria-label="Heading size"
          type="range"
          min={8}
          max={20}
          step={1}
          value={choices.headingSize}
          onChange={(event) =>
            onChange({ ...choices, headingSize: Number(event.target.value) })
          }
        />
        <span>{choices.headingSize} pt</span>
      </label>
      <span>Repeats</span>
      <select
        className="select"
        aria-label="Repeats"
        value={choices.repeats}
        onChange={(event) =>
          onChange({
            ...choices,
            repeats: event.target.value as 'full' | 'pointer',
          })
        }
      >
        <option value="full">Print in full</option>
        <option value="pointer">Repeat Chorus</option>
      </select>
      <span>Artist</span>
      <input
        type="checkbox"
        aria-label="Show artist"
        checked={choices.showArtist}
        onChange={(event) =>
          onChange({ ...choices, showArtist: event.target.checked })
        }
      />
      <span>Key and tempo</span>
      <input
        type="checkbox"
        aria-label="Show key and tempo"
        checked={choices.showKey}
        onChange={(event) =>
          onChange({ ...choices, showKey: event.target.checked })
        }
      />
      <span>Time signature</span>
      <input
        type="checkbox"
        aria-label="Show time signature"
        checked={choices.showTime}
        onChange={(event) =>
          onChange({ ...choices, showTime: event.target.checked })
        }
      />
      <span>Chord spacing</span>
      <label className="choice-slider">
        <input
          aria-label="Chord and lyric spacing"
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={choices.chordLyricSpacing}
          onChange={(event) =>
            onChange({
              ...choices,
              chordLyricSpacing: Number(event.target.value),
            })
          }
        />
        <span>{choices.chordLyricSpacing.toFixed(1)}×</span>
      </label>
      <span>Section gap</span>
      <label className="choice-slider">
        <input
          aria-label="Space before the next section"
          type="range"
          min={0}
          max={36}
          step={2}
          value={choices.sectionLeadIn}
          onChange={(event) =>
            onChange({ ...choices, sectionLeadIn: Number(event.target.value) })
          }
        />
        <span>{choices.sectionLeadIn} pt</span>
      </label>
      <span>Column divider</span>
      <input
        type="checkbox"
        aria-label="Show column divider"
        checked={choices.showColumnDivider}
        disabled={choices.columns === 1}
        onChange={(event) =>
          onChange({ ...choices, showColumnDivider: event.target.checked })
        }
      />
      <span>Section divider</span>
      <input
        type="checkbox"
        aria-label="Show section divider"
        checked={choices.showSectionDivider}
        onChange={(event) =>
          onChange({ ...choices, showSectionDivider: event.target.checked })
        }
      />
    </div>
  )
}

type PreviewItem =
  | {
      kind: 'page'
      key: string
      label: string
      page: PdfPage
      layout: PdfDocument
    }
  | { kind: 'blank'; key: string; label: string; width: number; height: number }

function previewPages(layout: SetlistLayout): PreviewItem[] {
  const items: PreviewItem[] = []
  let number = 0
  for (const [index, sheet] of layout.sheets.entries()) {
    if (sheet.kind === 'blank') {
      number += 1
      items.push({
        kind: 'blank',
        key: `blank-${index}`,
        label: `Blank · Page ${number}`,
        width: sheet.width,
        height: sheet.height,
      })
      continue
    }
    sheet.layout.pages.forEach((page, pageIndex) => {
      number += 1
      items.push({
        kind: 'page',
        key: `${index}-${page.pageLabel}-${pageIndex}`,
        label: `${page.title} · Page ${number}`,
        page,
        layout: sheet.layout,
      })
    })
  }
  return items
}
