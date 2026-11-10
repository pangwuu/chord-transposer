import { useState } from 'react'
import { importChartPaste, type ChartPasteResult } from '../domain/chart-paste'
import { chordTextFromPdfItems } from '../domain/import-text'
import { addBarChord, issuesIn, type Song } from '../domain/song'
import { Chart } from './chart'

const SOURCE_LABEL = {
  'ultimate-guitar': 'Ultimate Guitar',
  chordie: 'Chordie',
  'e-chords': 'E-Chords',
} as const

export function ImportScreen({ onCancel, onSave }: { onCancel: () => void; onSave: (song: Song) => void }) {
  const [source, setSource] = useState('')
  const [notice, setNotice] = useState('')
  const [result, setResult] = useState<ChartPasteResult | null>(null)
  const replaceSource = (text: string) => {
    setSource(text)
    setResult(text.trim() ? importChartPaste(text) : null)
  }
  return (
    <div className="import-screen">
      <div className="import-body">
        <h2>Review import</h2>
        <p className="hint">Paste ChordPro, chords-over-lyrics, or a whole page from Ultimate Guitar, Chordie, or E-Chords. Copyrighted charts stay in a file on your computer.</p>
        <label className="outline file-button">
          Choose file
          <input className="clip" aria-label="Import file" type="file" accept=".cho,.chordpro,.chopro,.crd,.txt,.pro,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file, replaceSource, setNotice) }} />
        </label>
        {result && (
          <div className="chips">
            <span className="chip ok">{result.chordCount} chords</span>
            <span className={result.issues.length ? 'chip warn' : 'chip ok'}>{result.issues.length ? `${result.issues.length} to check` : 'All chords read'}</span>
            <span className="chip">{result.sectionCount} sections</span>
            <span className="chip">Key {result.detectedKey}</span>
            <span className="chip">{result.format}</span>
            {result.source && <span className="chip ok">{SOURCE_LABEL[result.source]}</span>}
          </div>
        )}
        {(notice || (result?.notices?.length ?? 0) > 0 || (result?.issues.length ?? 0) > 0) && (
          <div className="import-notes">
            {notice && <p className="check-line">{notice}</p>}
            {result?.notices?.map((item) => <p className="check-line" key={item}>{item}</p>)}
            {result?.issues.map((issue) => <p className="check-line" key={`${issue.line}-${issue.raw}`}>Line {issue.line}: {issue.raw} is kept as written.</p>)}
          </div>
        )}
        <div className={result ? 'import-panes has-result' : 'import-panes'}>
          <textarea className="source" aria-label="Source text" value={source} onChange={(event) => replaceSource(event.target.value)} />
          {result && (
            <div className="result">
              <Chart
                song={result.song}
                shapeKey={result.song.originalKey}
                numbers={false}
                selectedIds={[]}
                readOnly
                onSelect={() => {}}
                onAdd={() => {}}
                onCheck={() => {}}
                onRename={() => {}}
                onDuplicate={() => {}}
                onDeleteSection={() => {}}
                onMoveSection={() => {}}
                onPlaceSection={() => {}}
                onAddSection={() => {}}
                onComment={() => {}}
                onBars={() => {}}
                onAddBar={(sectionId, lineId) => {
                  setResult((current) => {
                    if (!current) return current
                    const song = addBarChord(current.song, sectionId, lineId)
                    if (song === current.song) return current
                    return { ...current, song, chordCount: current.chordCount + 1 }
                  })
                }}
                onNudge={() => {}}
                onMove={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
              />
              {issuesIn(result.song).length === 0 && result.chordCount === 0 && <p className="hint">Nothing to save yet.</p>}
            </div>
          )}
        </div>
      </div>
      <div className="import-footer">
        <button className="text-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary" type="button" disabled={!result} onClick={() => result && onSave(result.song)}>Save song</button>
      </div>
    </div>
  )
}

async function readFile(file: File, setSource: (text: string) => void, setNotice: (text: string) => void) {
  setNotice('')
  if (file.name.toLowerCase().endsWith('.pdf')) {
    try {
      setSource(await textFromPdf(await file.arrayBuffer()))
    } catch {
      setNotice('Could not read that PDF. Paste the text instead.')
    }
    return
  }
  setSource(await file.text())
}

async function textFromPdf(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const items: { str: string; x: number; y: number }[] = []
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const x = item.transform[4]
      const y = item.transform[5] - (pageNumber - 1) * 2000
      items.push({ str: item.str, x, y })
    }
  }
  return chordTextFromPdfItems(items)
}
