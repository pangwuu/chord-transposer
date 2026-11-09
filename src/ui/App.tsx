import { useEffect, useMemo, useRef, useState } from 'react'
import { formatKey, formatSymbol, friendlyCapos, parseChord, parseKey, shiftKey } from '../domain/chord'
import {
  addAt,
  addSectionOf,
  changeLyric,
  checkLine,
  chooseCapo,
  chooseConcert,
  deleteSectionOf,
  duplicateSectionOf,
  moveChord,
  moveSectionOf,
  nudge,
  openEditor,
  redo,
  removeSelected,
  renameSectionOf,
  replaceSelected,
  saveConcertAsSongKey,
  selectChord,
  setChordText,
  setSongDetails,
  stepConcert,
  undo,
  viewSong,
  type EditorState,
} from '../domain/editor'
import { idbLibrary } from '../domain/idb-library'
import { layoutPdf } from '../domain/pdf-layout'
import { findPlacement, issuesIn, type Song } from '../domain/song'
import { amazingGrace, firstLight } from '../fixtures/charts'
import { emptySong } from '../domain/song'
import { Chart, type NudgeHow } from './chart'
import { Inspector } from './inspector'
import { PreviewPane } from './preview-pane'

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export function App() {
  const library = useRef(idbLibrary())
  const editorRef = useRef<EditorState | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const phone = usePhone()
  const [tab, setTab] = useState<'songs' | 'editor'>('editor')
  const [showPreview, setShowPreview] = useState(false)
  const [songs, setSongs] = useState<Song[]>([])
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Saved')
  const [toast, setToast] = useState<string | null>(null)
  const [live, setLive] = useState('')
  const [focusSignal, setFocusSignal] = useState(0)
  const [ready, setReady] = useState(false)
  editorRef.current = editor

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const snapshot = await library.current.load()
        let list = snapshot.songs
        if (list.length === 0) {
          list = [amazingGrace, firstLight]
          await Promise.all(list.map((song) => library.current.saveSong(song)))
        }
        if (cancel) return
        setSongs(list)
        setEditor(openEditor(list[0]))
        setReady(true)
      } catch {
        if (cancel) return
        const list = [amazingGrace, firstLight]
        setSongs(list)
        setEditor(openEditor(list[0]))
        setReady(true)
        setStatus('Not saved')
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!ready || !editor) return
    setSongs((current) => current.map((song) => (song.id === editor.song.id ? editor.song : song)))
    setStatus('Saving…')
    const timer = window.setTimeout(() => {
      library.current.saveSong(editor.song).then(() => setStatus('Saved')).catch(() => setStatus('Not saved'))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [editor?.song, ready])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = editorRef.current
      if (!state) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select')) return
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        setEditor(event.shiftKey ? redo(state) : undo(state))
        announce(event.shiftKey ? 'Redid' : 'Undid')
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        setEditor(redo(state))
        announce('Redid')
        return
      }
      if (meta && (event.key === ']' || event.key === '[')) {
        event.preventDefault()
        setEditor(stepConcert(state, event.key === ']' ? 1 : -1))
        return
      }
      if (meta && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        const sectionId = sectionOf(state)
        if (sectionId) setEditor(duplicateSectionOf(state, sectionId))
        return
      }
      if (event.altKey && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        const sectionId = sectionOf(state)
        if (sectionId) setEditor(moveSectionOf(state, sectionId, event.key === 'ArrowUp' ? -1 : 1))
        return
      }
      if (state.selectedIds.length === 0) return
      if (event.key === 'Escape') {
        setEditor(selectChord(state, null))
        return
      }
      if (event.key === 'Enter' || event.key === 'F2') {
        event.preventDefault()
        setFocusSignal((value) => value + 1)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeChord(state)
        return
      }
      const how = nudgeHow(event)
      if (!how) return
      event.preventDefault()
      setEditor(nudge(state, how))
      announce('Chord moved')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const view = editor ? viewSong(editor) : null
  const shapeKey = editor ? shiftKey(editor.concert, -editor.capo, editor.prefs) : null
  const layout = useMemo(() => {
    if (!editor) return null
    return layoutPdf(editor.song, {
      paper: 'a4',
      fontSize: 12,
      columns: 1,
      fit: 'auto',
      content: 'full',
      numbers: editor.nashville,
      capo: editor.capo,
      concert: editor.concert,
      repeats: 'full',
      allowTwoColumns: true,
    })
  }, [editor])

  function announce(text: string) {
    setLive(text)
    setToast(text)
  }

  function removeChord(state: EditorState) {
    const id = state.selectedIds[0]
    const placed = id ? findPlacement(viewSong(state), id) : null
    const symbol = placed && placed.line.type === 'lyric' ? placed.line.chords[placed.index]?.symbol : null
    setEditor(removeSelected(state))
    announce(symbol ? `Deleted ${formatSymbol(symbol)}` : 'Deleted chord')
  }

  function editChord(text: string) {
    const state = editorRef.current
    if (!state || state.selectedIds.length !== 1 || text.trim().length === 0) return
    if (parseChord(text).kind === 'invalid') announce(`‘${text}’ isn't a recognised chord. Kept as typed.`)
    setEditor(setChordText(state, state.selectedIds[0], text))
  }

  function replaceChord(text: string) {
    const state = editorRef.current
    if (!state) return
    const result = replaceSelected(state, text)
    setEditor(result.state)
    announce(`Replaced ${result.count} with ${text}`)
  }

  async function exportPdf() {
    if (!layout) return
    const [{ renderPdf }, { loadPdfFonts }] = await Promise.all([import('../domain/pdf-render'), import('./fonts')])
    const fonts = await loadPdfFonts()
    const bytes = await renderPdf(layout, fonts)
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    link.download = layout.fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  async function openSong(song: Song) {
    const current = editorRef.current
    if (current) await library.current.saveSong(current.song)
    setEditor(openEditor(song))
    setTab('editor')
    setShowPreview(false)
  }

  async function createSong() {
    const song = emptySong({ title: 'Untitled song' })
    await library.current.saveSong(song)
    setSongs((current) => [song, ...current])
    setEditor(openEditor(song))
    setTab('editor')
  }

  const visible = songs.filter((song) => song.title.toLowerCase().includes(query.trim().toLowerCase()))
  const issues = view ? issuesIn(view) : []
  const transposed = editor ? formatKey(editor.concert) !== formatKey(editor.song.originalKey) : false
  const selectedId = editor?.selectedIds[0] ?? null
  const concertLabel = editor && view && selectedId && editor.capo > 0 ? concertName(editor, selectedId) : null

  return (
    <div className={['app', phone ? (tab === 'songs' ? 'phone-songs' : 'phone-editor') : '', showPreview ? 'show-preview' : ''].filter(Boolean).join(' ')}>
      <aside className="library">
        <div className="brand"><span>Chord Sheet Maker</span></div>
        <input ref={searchRef} className="search" aria-label="Search songs" placeholder="Search songs" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="library-scroll">
          {visible.length === 0 && <p className="empty">No songs match.</p>}
          {visible.map((song) => (
            <button key={song.id} type="button" className={song.id === editor?.song.id ? 'song-row active' : 'song-row'} onClick={() => openSong(song)}>
              <strong>{song.title}</strong>
              <span className="row-meta"><span>{song.artist ?? 'No artist'}</span><span className="key-badge">{formatKey(song.originalKey)}</span></span>
            </button>
          ))}
        </div>
        <div className="side-nav">
          <button className="nav-button" type="button" onClick={createSong}>+ New song</button>
        </div>
      </aside>
      {editor && view && shapeKey && layout && (
        <main className="editor">
          <header className="editor-bar">
            {phone && <button className="text-button" type="button" onClick={() => setTab('songs')}>Songs</button>}
            <strong>{editor.song.title}</strong>
            <span className="meta">{status === 'Not saved' ? '· Not saved' : status === 'Saving…' ? '· Saving…' : '· Saved'}</span>
            <span className="grow" />
            <button className="text-button" type="button" onClick={() => { setEditor(undo(editor)); announce('Undid') }}>Undo</button>
            <button className="text-button" type="button" onClick={() => { setEditor(redo(editor)); announce('Redid') }}>Redo</button>
            <button className="text-button" type="button" aria-pressed={showPreview} onClick={() => setShowPreview((value) => !value)}>Preview</button>
          </header>
          <div className="transport">
            <button className="outline" type="button" aria-label="Key down a semitone" onClick={() => setEditor(stepConcert(editor, -1))}>−</button>
            <select className="select" aria-label="Key" value={formatKey(editor.concert)} onChange={(event) => setEditor(chooseConcert(editor, parseKey(event.target.value)))}>
              <optgroup label="Major">{KEYS.map((key) => <option key={key}>{key}</option>)}</optgroup>
              <optgroup label="Minor">{KEYS.map((key) => <option key={`${key}m`}>{key}m</option>)}</optgroup>
            </select>
            <button className="outline" type="button" aria-label="Key up a semitone" onClick={() => setEditor(stepConcert(editor, 1))}>+</button>
            <select className="select" aria-label="Capo" value={editor.capo} onChange={(event) => setEditor(chooseCapo(editor, Number(event.target.value)))}>
              {Array.from({ length: 12 }, (_, capo) => <option key={capo} value={capo}>{capo === 0 ? 'Capo off' : `Capo ${capo}`}</option>)}
            </select>
            <button className="outline" type="button" aria-pressed={editor.nashville} onClick={() => setEditor({ ...editor, nashville: !editor.nashville })}>1-4-5</button>
            {transposed && <span className="chip">From {formatKey(editor.song.originalKey)}</span>}
            {transposed && <button className="text-button" type="button" onClick={() => { setEditor(saveConcertAsSongKey(editor)); announce(`Saved in ${formatKey(editor.concert)}`) }}>Save as song key</button>}
            <span className="grow" />
            <button className={issues.length ? 'chip warn' : 'chip ok'} type="button" onClick={() => issues[0] && setEditor(selectChord(editor, issues[0].id))}>
              {issues.length ? `${issues.length} to check` : 'All chords valid'}
            </button>
          </div>
          <div className="editor-body">
            <div className="editor-scroll">
              <DetailField className="title-input" label="Title" value={editor.song.title} onCommit={(title) => setEditor(setSongDetails(editor, { title }))} />
              <div className="properties">
                <span className="meta">Artist</span>
                <DetailField label="Artist" value={editor.song.artist ?? ''} onCommit={(artist) => setEditor(setSongDetails(editor, { artist }))} />
                <span className="meta">Tempo</span>
                <DetailField label="Tempo" value={editor.song.tempo ? String(editor.song.tempo) : ''} onCommit={(tempo) => { const value = Number(tempo); setEditor(setSongDetails(editor, { tempo: tempo.trim() && Number.isFinite(value) ? value : undefined })) }} />
                <span className="meta">Time</span>
                <DetailField label="Time signature" value={editor.song.timeSignature ?? ''} onCommit={(timeSignature) => setEditor(setSongDetails(editor, { timeSignature }))} />
              </div>
              {editor.capo > 0 && <p className="capo-banner">Capo {editor.capo} · showing {formatKey(shapeKey).replace(/m$/, '')} shapes · sounds in {formatKey(editor.concert)}</p>}
              <div className="chips">
                {friendlyCapos(editor.concert).filter((item) => item.capo > 0).map((item) => (
                  <button key={item.shapes} className="chip" type="button" onClick={() => setEditor(chooseCapo(editor, item.capo))}>Capo {item.capo} · {item.shapes}</button>
                ))}
              </div>
              <Chart
                song={view}
                shapeKey={shapeKey}
                numbers={editor.nashville}
                selectedIds={editor.selectedIds}
                readOnly={false}
                onSelect={(id, shift) => setEditor(selectChord(editor, id, shift))}
                onAdd={(lineId, index) => {
                  const next = addAt(editor, lineId, index)
                  setEditor(next)
                  setFocusSignal((value) => value + 1)
                  announce('Chord added')
                }}
                onLyric={(lineId, text) => setEditor(changeLyric(editor, lineId, text))}
                onCheck={(lineId) => setEditor(checkLine(editor, lineId))}
                onRename={(sectionId, label) => setEditor(renameSectionOf(editor, sectionId, label))}
                onDuplicate={(sectionId) => setEditor(duplicateSectionOf(editor, sectionId))}
                onDeleteSection={(sectionId) => setEditor(deleteSectionOf(editor, sectionId))}
                onMoveSection={(sectionId, direction) => setEditor(moveSectionOf(editor, sectionId, direction))}
                onAddSection={(kind, label) => setEditor(addSectionOf(editor, kind, label))}
                onNudge={(how) => { setEditor(nudge(editor, how)); announce('Chord moved') }}
                onMove={(id, lineId, index) => {
                  const found = findPlacement(editor.song, id)
                  const placement = found && found.line.type === 'lyric' ? found.line.chords[found.index] : null
                  if (placement && found?.line.id === lineId && placement.index === index) return
                  setEditor(moveChord(editor, id, lineId, index))
                  announce('Chord moved')
                }}
                onEdit={() => setFocusSignal((value) => value + 1)}
                onDelete={() => removeChord(editor)}
              />
            </div>
            <Inspector
              song={view}
              shapeKey={shapeKey}
              selectedId={selectedId}
              concertLabel={concertLabel}
              focusSignal={focusSignal}
              onText={editChord}
              onReplace={replaceChord}
              onDelete={() => removeChord(editor)}
              onClose={() => setEditor(selectChord(editor, null))}
            />
          </div>
        </main>
      )}
      {layout && <PreviewPane layout={layout} onExport={exportPdf} />}
      <div className="phone-tabs">
        <button type="button" aria-pressed={tab === 'songs'} onClick={() => setTab('songs')}>Songs</button>
        <button type="button" aria-pressed={tab === 'editor'} onClick={() => setTab('editor')}>Editor</button>
        <button type="button" aria-pressed={showPreview} onClick={() => { setTab('editor'); setShowPreview((value) => !value) }}>Preview</button>
      </div>
      <p className="live" aria-live="polite">{live}</p>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button className="text-button" type="button" onClick={() => { const state = editorRef.current; if (state) setEditor(undo(state)); setToast(null); setLive('Undid') }}>Undo</button>
        </div>
      )}
    </div>
  )
}

function DetailField({ label, value, onCommit, className = 'field' }: { label: string; value: string; onCommit: (value: string) => void; className?: string }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      className={className}
      aria-label={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

function concertName(state: EditorState, id: string): string | null {
  const sounding = viewSong({ ...state, capo: 0 })
  const placed = findPlacement(sounding, id)
  if (!placed || placed.line.type !== 'lyric') return null
  const symbol = placed.line.chords[placed.index]?.symbol
  return symbol ? formatSymbol(symbol) : null
}

function sectionOf(state: EditorState): string | null {
  const id = state.selectedIds[0]
  if (!id) return state.song.sections[0]?.id ?? null
  return findPlacement(state.song, id)?.section.id ?? null
}

function nudgeHow(event: KeyboardEvent): NudgeHow | null {
  if (event.altKey && event.key === 'ArrowLeft') return 'word-left'
  if (event.altKey && event.key === 'ArrowRight') return 'word-right'
  if (event.key === 'ArrowLeft') return 'left'
  if (event.key === 'ArrowRight') return 'right'
  if (event.key === 'Home') return 'start'
  if (event.key === 'End') return 'end'
  return null
}

function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setPhone(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return phone
}
