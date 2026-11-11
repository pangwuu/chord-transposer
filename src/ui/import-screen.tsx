import { useState } from 'react'
import { formatKey, parseKey, shiftKey } from '../domain/chord'
import { importChartPaste, type ChartPasteResult } from '../domain/chart-paste'
import {
  addAt,
  addBarChordOf,
  checkLine,
  chooseCapo,
  deleteSectionOf,
  moveChord,
  nudge,
  openEditor,
  removeSelected,
  renameSectionOf,
  selectChord,
  setChordText,
  setSongDetails,
  undo,
  viewSong,
  type EditorState,
} from '../domain/editor'
import { chordTextFromPdfItems, countChords } from '../domain/import-text'
import { issuesIn, placementLabel, type Song } from '../domain/song'
import { Chart } from './chart'

const SOURCE_LABEL = {
  'ultimate-guitar': 'Ultimate Guitar',
  chordie: 'Chordie',
  'e-chords': 'E-Chords',
} as const

/** A jump of this many characters in one change is a paste, not typing. */
const PASTE_SIZE = 20

export type SharedPaste = { text: string; notice: string }

/** Text handed over by the Android share sheet, read once from the address bar. */
export function readSharedPaste(): SharedPaste | null {
  const params = new URLSearchParams(location.search)
  const text = params.get('text') ?? ''
  if (!text && !params.get('url')) return null
  history.replaceState(null, '', location.pathname)
  const onlyLink = !text.trim() || /^https?:\/\/\S+$/.test(text.trim())
  return onlyLink ? { text: '', notice: 'Only a link was shared. Copy the chart text on that page, then tap Paste.' } : { text, notice: '' }
}

function reviewState(song: Song): EditorState {
  const capo = song.views[0]?.capo ?? 0
  return capo ? chooseCapo(openEditor(song), capo) : openEditor(song)
}

export function ImportScreen({
  phone,
  shared,
  onCancel,
  onSave,
}: {
  phone: boolean
  shared: SharedPaste | null
  onCancel: () => void
  onSave: (song: Song) => void
}) {
  const [source, setSource] = useState(shared?.text ?? '')
  const [notice, setNotice] = useState(shared?.notice ?? '')
  const [result, setResult] = useState<ChartPasteResult | null>(() => (shared?.text ? importChartPaste(shared.text) : null))
  const [editor, setEditor] = useState<EditorState | null>(() => (result ? reviewState(result.song) : null))
  const [reviewing, setReviewing] = useState(Boolean(shared?.text))
  const [showSource, setShowSource] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const read = (text: string, advance: boolean) => {
    setSource(text)
    setEditingId(null)
    if (!text.trim()) {
      setResult(null)
      setEditor(null)
      setReviewing(false)
      return
    }
    const next = importChartPaste(text)
    setResult(next)
    setEditor(reviewState(next.song))
    if (advance) setReviewing(true)
  }

  const keepsFixes = () => Boolean(editor && editor.past.length > 0) && !window.confirm('This replaces the fixes you made here. Continue?')

  const changeSource = (text: string) => {
    if (!keepsFixes()) read(text, text.length - source.length > PASTE_SIZE)
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) {
        if (!keepsFixes()) read(text, true)
      }
      else setNotice('Nothing to paste yet. Copy the chart first.')
    } catch {
      setNotice('Could not read the clipboard. Press and hold in the box, then choose Paste.')
    }
  }

  const reviewVisible = Boolean(result && editor) && (!phone || reviewing)
  const sourceVisible = !phone || !reviewing || showSource
  const canPaste = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText)
  const issues = editor ? issuesIn(editor.song) : []
  const chordCount = editor ? countChords(editor.song) : 0
  const view = editor ? viewSong(editor) : null
  const shapeKey = editor ? shiftKey(editor.concert, -editor.capo, editor.prefs) : null

  const jumpToIssue = () => {
    if (!editor || !issues[0]) return
    setEditor(selectChord(editor, issues[0].id))
    setEditingId(issues[0].id)
    requestAnimationFrame(() => document.querySelector('.import-screen .chord.invalid')?.scrollIntoView({ block: 'center' }))
  }

  const commitKey = (text: string) => {
    if (!editor || !text.trim()) return
    try {
      const key = parseKey(text.trim())
      if (formatKey(key) === formatKey(editor.song.originalKey)) return
      setEditor({ ...setSongDetails(editor, { originalKey: key }), concert: key })
      setResult((current) => (current ? { ...current, keyGuessed: false } : current))
    } catch {
      setNotice(`‘${text}’ isn't a key`)
    }
  }

  return (
    <div className="import-screen">
      <div className={reviewVisible && phone ? 'import-body reviewing' : 'import-body'}>
        <h2>{phone && !reviewing ? 'Import a song' : 'Review import'}</h2>
        {!reviewVisible || !phone ? <p className="hint">Copy a chart from any site, or a whole page, and paste it here. Copyrighted charts stay on this device.</p> : null}
        <div className="import-actions">
          {canPaste && (!phone || !reviewing) && <button className="primary" type="button" onClick={() => void pasteFromClipboard()}>Paste</button>}
          <label className="outline file-button">
            Choose file
            <input className="clip" aria-label="Import file" type="file" accept=".cho,.chordpro,.chopro,.crd,.txt,.pro,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file && !keepsFixes()) void readFile(file, (text) => read(text, true), setNotice) }} />
          </label>
          {phone && result && !reviewing && <button className="outline" type="button" onClick={() => setReviewing(true)}>Review</button>}
          {phone && reviewing && <button className="text-button" type="button" aria-expanded={showSource} onClick={() => setShowSource((value) => !value)}>{showSource ? 'Hide source' : 'Show source'}</button>}
          {editor && editor.past.length > 0 && <button className="text-button" type="button" onClick={() => setEditor(undo(editor))}>Undo</button>}
        </div>
        {result && editor && (
          <div className="chips">
            <span className="chip ok">{chordCount} chords</span>
            {issues.length > 0 ? <button className="chip warn" type="button" onClick={jumpToIssue}>{issues.length} to check</button> : <span className="chip ok">All chords read</span>}
            <span className="chip">{editor.song.sections.length} sections</span>
            {result.source && <span className="chip ok">{SOURCE_LABEL[result.source]}</span>}
          </div>
        )}
        {(notice || (result?.notices?.length ?? 0) > 0) && (
          <div className="import-notes">
            {notice && <p className="check-line">{notice}</p>}
            {result?.notices?.map((item) => <p className="hint" key={item}>{item}</p>)}
          </div>
        )}
        <div className={reviewVisible ? 'import-panes has-result' : 'import-panes'}>
          {sourceVisible && <textarea className="source" aria-label="Source text" placeholder="Paste the chart here" value={source} onPaste={() => setNotice('')} onChange={(event) => changeSource(event.target.value)} />}
          {reviewVisible && editor && view && shapeKey && result && (
            <div className="result">
              <div className="review-fields">
                <input className="field review-title" aria-label="Imported title" placeholder="Song title" value={editor.song.title} onChange={(event) => setEditor(setSongDetails(editor, { title: event.target.value }))} />
                <input className="field" aria-label="Imported artist" placeholder="Artist" value={editor.song.artist ?? ''} onChange={(event) => setEditor(setSongDetails(editor, { artist: event.target.value }))} />
                <label className="review-key">
                  <span className="meta">Key{result.keyGuessed ? ' (guessed)' : ''}</span>
                  <input key={formatKey(editor.song.originalKey)} className="field" aria-label="Imported key" defaultValue={formatKey(editor.song.originalKey)} onBlur={(event) => commitKey(event.target.value)} />
                </label>
              </div>
              <div className="chips" aria-label="Song order">
                {performanceOrder(editor.song).map((label, index) => <span className="chip" key={`${label}-${index}`}>{label}</span>)}
              </div>
              {editor.capo > 0 && <p className="capo-banner">Capo {editor.capo} · showing {formatKey(shapeKey).replace(/m$/, '')} shapes · sounds in {formatKey(editor.concert)}</p>}
              <Chart
                song={view}
                shapeKey={shapeKey}
                numbers={false}
                selectedIds={editor.selectedIds}
                readOnly={false}
                compact
                onSelect={(id, shift) => { setEditor(selectChord(editor, id, shift)); setEditingId(null) }}
                onAdd={(lineId, index) => setEditor(addAt(editor, lineId, index))}
                onCheck={(lineId) => setEditor(checkLine(editor, lineId))}
                onRename={(sectionId, label) => setEditor(renameSectionOf(editor, sectionId, label))}
                onDuplicate={() => {}}
                onDeleteSection={(sectionId) => setEditor(deleteSectionOf(editor, sectionId))}
                onMoveSection={() => {}}
                onPlaceSection={() => {}}
                onAddSection={() => {}}
                onComment={() => {}}
                onBars={() => {}}
                onAddBar={(sectionId, lineId) => setEditor(addBarChordOf(editor, sectionId, lineId))}
                onNudge={(how) => setEditor(nudge(editor, how))}
                onMove={(id, lineId, index) => setEditor(moveChord(editor, id, lineId, index))}
                onEdit={setEditingId}
                onDelete={() => setEditor(removeSelected(editor))}
              />
              {chordCount === 0 && <p className="hint">No chords found yet. Check the source, or paste the Chords version of the page.</p>}
            </div>
          )}
        </div>
      </div>
      {editingId && editor && view && (
        <form
          className="review-chord"
          onSubmit={(event) => {
            event.preventDefault()
            const text = String(new FormData(event.currentTarget).get('chord') ?? '').trim()
            if (text) setEditor(setChordText(editor, editingId, text))
            setEditingId(null)
          }}
        >
          <input key={editingId} className="field" name="chord" aria-label="Chord name" autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} defaultValue={placementLabel(view, editingId) ?? ''} />
          <button className="outline" type="submit">Done</button>
        </form>
      )}
      <div className="import-footer">
        <button className="text-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary" type="button" disabled={!editor} onClick={() => editor && onSave(editor.song)}>Save song</button>
      </div>
    </div>
  )
}

function performanceOrder(song: Song): string[] {
  return song.arrangement.flatMap((item) => {
    const section = song.sections.find((candidate) => candidate.id === item.sectionId)
    if (!section) return []
    return [item.repeat && item.repeat > 1 ? `${section.label} ×${item.repeat}` : section.label]
  })
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

