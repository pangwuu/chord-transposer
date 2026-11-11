import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Guitar, RotateCcw, TriangleAlert } from 'lucide-react'
import { accidentalBias, chooseAccidentalBias, formatKey, prefsForBias, formatSymbol, keyFromPitch, normaliseSymbol, notePitch, parseChord, parseKey, shiftKey, type SpellingPrefs } from '../domain/chord'
import {
  addAt,
  addSectionOf,
  checkLine,
  chooseCapo,
  chooseConcert,
  deleteSectionOf,
  duplicateSectionOf,
  addBarChordOf,
  editNoteOf,
  removeLineOf,
  addCommentOf,
  applyChordProOf,
  moveChord,
  moveSectionOf,
  nudge,
  openEditor,
  placeSectionOf,
  redo,
  removeSelected,
  renameSectionOf,
  repeatArrangementOf,
  replaceSelected,
  resetView,
  saveConcertAsSongKey,
  selectChord,
  setChordText,
  setSongDetails,
  stepConcert,
  undo,
  viewSong,
  type EditorState,
} from '../domain/editor'
import { applyRestore, planRestore, type BackupFile } from '../domain/backup'
import { toChordPro } from '../domain/chordpro'
import { idbLibrary } from '../domain/idb-library'
import { defaultSettings, type Setlist, type Settings } from '../domain/library-types'
import { layoutPdf, layoutSetlist } from '../domain/pdf-layout'
import { encodeShare, decodeShare } from '../domain/share'
import { findPlacement, issuesIn, mapSymbols, type Song } from '../domain/song'
import { amazingGrace, firstLight } from '../fixtures/charts'
import { emptySong } from '../domain/song'
import { Chart, type NudgeHow } from './chart'
import { ChordProPane } from './chordpro-pane'
import { defaultPdfChoices, ExportDialog, SetlistExportDialog, type PdfChoices } from './export-dialog'
import { ImportScreen, readSharedPaste } from './import-screen'
import { Inspector } from './inspector'
import { PreviewPane } from './preview-pane'
import { ProjectorView, StageView, type StageEntry } from './performance'
import { SetlistScreen, setlistName } from './setlist-screen'
import { SettingsScreen } from './settings-screen'

const BASE_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

function keyOptions(prefs: SpellingPrefs): string[] {
  return BASE_KEYS.map((name) => {
    if (name === 'F#' && prefs.gb) return 'Gb'
    if (name === 'Db' && prefs.csharp) return 'C#'
    return name
  })
}

/** Read outside render: it clears the address bar, and strict mode renders twice. */
const launchPaste = readSharedPaste()

export function App() {
  const library = useRef(idbLibrary())
  const editorRef = useRef<EditorState | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const phone = usePhone()
  const [sharedPaste, setSharedPaste] = useState(launchPaste)
  const [place, setPlace] = useState<'songs' | 'editor' | 'sets' | 'settings' | 'import'>(() => (sharedPaste ? 'import' : phone ? 'songs' : 'editor'))
  const [mode, setMode] = useState<'visual' | 'chordpro'>('visual')
  const [menuOpen, setMenuOpen] = useState(false)
  const [performance, setPerformance] = useState<
    | { mode: 'stage'; entries: StageEntry[]; nashville: boolean }
    | { mode: 'projector'; songs: Song[] }
    | null
  >(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [setlistExport, setSetlistExport] = useState<Setlist | null>(null)
  const [setlistPrefs, setSetlistPrefs] = useState<SpellingPrefs>(() => defaultSettings().prefs)
  const [songs, setSongs] = useState<Song[]>([])
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [settings, setSettings] = useState<Settings>(defaultSettings())
  const [pdfChoices, setPdfChoices] = useState<PdfChoices>(defaultPdfChoices)
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
        const hash = location.hash.replace(/^#/, '')
        if (hash.startsWith('1.')) {
          try {
            const shared = decodeShare(hash)
            if (!list.some((song) => song.id === shared.id)) {
              list = [shared, ...list]
              await library.current.saveSong(shared)
              if (!cancel) setPlace('editor')
            }
            history.replaceState(null, '', location.pathname)
          } catch { /* ignore a bad share link */ }
        }
        if (cancel) return
        setSongs(list)
        setSetlists(snapshot.setlists)
        setSettings(snapshot.settings)
        setPdfChoices((choices) => ({ ...choices, paper: snapshot.settings.paper, fontSize: snapshot.settings.lyricSize }))
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
      ...pdfChoices,
      numbers: editor.nashville,
      capo: editor.capo,
      concert: editor.concert,
      prefs: editor.prefs,
      allowTwoColumns: settings.allowTwoColumns,
    })
  }, [editor, pdfChoices, settings.allowTwoColumns])

  const setlistLayout = useMemo(() => {
    if (!setlistExport) return null
    const entries = setlistExport.entries.flatMap((entry) => {
      const song = songs.find((item) => item.id === entry.songId)
      if (!song) return []
      const concert = entry.key ?? song.originalKey
      return [{ song, capo: entry.capo ?? 0, concert: keyFromPitch(notePitch(concert.tonic), concert.mode, setlistPrefs) }]
    })
    return layoutSetlist(entries, {
      ...pdfChoices,
      numbers: settings.numbers,
      prefs: setlistPrefs,
      allowTwoColumns: settings.allowTwoColumns,
    }, false)
  }, [setlistExport, songs, pdfChoices, settings.numbers, setlistPrefs, settings.allowTwoColumns])

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

  async function downloadBytes(bytes: Uint8Array, name: string) {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportPdf() {
    if (!layout) return
    const [{ renderPdf }, { loadPdfFonts }] = await Promise.all([import('../domain/pdf-render'), import('./fonts')])
    const fonts = await loadPdfFonts()
    await downloadBytes(await renderPdf(layout, fonts), layout.fileName)
    setExportOpen(false)
  }

  async function exportSetlist() {
    if (!setlistExport || !setlistLayout || setlistLayout.pageCount === 0) return
    const [{ renderPdf, mergePdfs }, { loadPdfFonts }] = await Promise.all([import('../domain/pdf-render'), import('./fonts')])
    const fonts = await loadPdfFonts()
    const parts: Uint8Array[] = []
    for (const sheet of setlistLayout.sheets) {
      if (sheet.kind === 'song') parts.push(await renderPdf(sheet.layout, fonts))
    }
    if (parts.length === 0) return
    await downloadBytes(await mergePdfs(parts), setlistFileName(setlistExport))
    setSetlistExport(null)
  }

  async function openSong(song: Song) {
    const current = editorRef.current
    if (current) await library.current.saveSong(current.song)
    const opened = openEditor(song)
    setEditor({ ...opened, prefs: settings.prefs, concert: keyFromPitch(notePitch(opened.concert.tonic), opened.concert.mode, settings.prefs) })
    setPlace('editor')
  }

  async function restoreBackup(file: File) {
    const backup = JSON.parse(await file.text()) as BackupFile
    const plan = planRestore(songs, backup.songs ?? [])
    const choices: Record<string, 'replace' | 'keep'> = {}
    for (const id of plan.conflicts) {
      const title = backup.songs.find((song) => song.id === id)?.title ?? 'this song'
      if (window.confirm(`A song already uses this copy of “${title}”. Replace it?`)) choices[id] = 'replace'
    }
    const next = applyRestore(songs, backup.songs ?? [], choices)
    setSongs(next)
    await Promise.all(next.map((song) => library.current.saveSong(song)))
    for (const setlist of backup.setlists ?? []) await library.current.saveSetlist(setlist)
    if (backup.setlists) setSetlists(backup.setlists)
    announce('Backup restored')
  }

  async function createSong() {
    const song = emptySong({ title: 'Untitled song' })
    await library.current.saveSong(song)
    setSongs((current) => [song, ...current])
    setEditor(openEditor(song))
    setPlace('editor')
  }

  async function deleteCurrentSong() {
    const current = editor
    if (!current) return
    if (!window.confirm(`Delete song “${current.song.title}”? This cannot be undone.`)) return
    const id = current.song.id
    await library.current.deleteSong(id)
    const remaining = songs.filter((song) => song.id !== id)
    setSongs(remaining)
    setSetlists((currentSetlists) =>
      currentSetlists.map((setlist) => ({
        ...setlist,
        entries: setlist.entries.filter((entry) => entry.songId !== id),
      })),
    )
    setMenuOpen(false)
    if (remaining[0]) {
      const opened = openEditor(remaining[0])
      setEditor({
        ...opened,
        prefs: settings.prefs,
        concert: keyFromPitch(notePitch(opened.concert.tonic), opened.concert.mode, settings.prefs),
      })
      setPlace('editor')
    } else {
      setEditor(null)
      setPlace('songs')
    }
    setLive('Song deleted')
  }

  function applyPrefs(prefs: SpellingPrefs) {
    const next = { ...settings, prefs }
    setSettings(next)
    void library.current.saveSettings(next)
    setEditor((state) => state && {
      ...state,
      prefs,
      concert: keyFromPitch(notePitch(state.concert.tonic), state.concert.mode, prefs),
    })
  }

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [menuOpen])

  const visible = songs.filter((song) => song.title.toLowerCase().includes(query.trim().toLowerCase()))
  const issues = view ? issuesIn(view) : []
  const transposed = editor ? formatKey(editor.concert) !== formatKey(editor.song.originalKey) : false
  const viewDirty = editor ? transposed || editor.capo > 0 : false
  const meter = editor ? meterLabel(editor.song) : null
  const selectedId = editor?.selectedIds[0] ?? null
  const concertLabel = editor && view && selectedId && editor.capo > 0 ? concertName(editor, selectedId) : null

  const phoneScreen = place === 'songs' ? 'songs' : place
  const phonePerformance = performance ? `phone-${performance.mode}` : ''
  const songsTabActive = place === 'songs' || place === 'editor' || place === 'import'


  return (
    <div className={['app', phone ? `phone-${phoneScreen}` : '', phonePerformance].filter(Boolean).join(' ')}>
      <aside className="library">
        <div className="brand"><span>Chord Sheet Maker</span></div>
        <input ref={searchRef} className="search" aria-label="Search songs" placeholder="Search songs" value={query} onChange={(event) => setQuery(event.target.value)} />
        {phone && <button className="primary import-cta" type="button" onClick={() => setPlace('import')}>Paste a chart</button>}
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
          <button className="nav-button" type="button" aria-pressed={place === 'import'} onClick={() => setPlace('import')}>Import</button>
          <button className="nav-button" type="button" aria-pressed={place === 'sets'} onClick={() => setPlace('sets')}>Setlists</button>
          <button className="nav-button" type="button" aria-pressed={place === 'settings'} onClick={() => setPlace('settings')}>Settings</button>
        </div>
      </aside>
      {(place === 'editor' || place === 'songs') && editor && view && shapeKey && layout && (
        <main className="editor">
          <header className="editor-bar">
            {phone && <button className="text-button" type="button" aria-label="Back to songs" onClick={() => setPlace('songs')}>‹</button>}
            <strong>{editor.song.title}</strong>
            <span className="meta">{status === 'Not saved' ? '· Not saved' : status === 'Saving…' ? '· Saving…' : '· Saved'}</span>
            <span className="grow" />
              <div className="editor-bar-phone" ref={menuRef}>
                <button
                  className="text-button bar-perform"
                  type="button"
                  aria-label="Performance view"
                  title="Performance view"
                  onClick={() => setPerformance({ mode: 'stage', entries: [{ song: editor.song, concert: editor.concert, capo: editor.capo }], nashville: editor.nashville })}
                >
                  <Guitar size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className="bar-perform-label">Performance view</span>
                </button>
                <button className="primary" type="button" onClick={() => setExportOpen(true)}>{phone ? 'Export' : 'Export PDF'}</button>
                <button className="text-button" type="button" aria-label="More actions" aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((open) => !open)}>Menu</button>
                {menuOpen && (
                  <div className="menu editor-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setEditor(undo(editor)); announce('Undid'); setMenuOpen(false) }}>Undo</button>
                    <button type="button" role="menuitem" onClick={() => { setEditor(redo(editor)); announce('Redid'); setMenuOpen(false) }}>Redo</button>
                    <button type="button" role="menuitem" onClick={() => { setMode((value) => value === 'visual' ? 'chordpro' : 'visual'); setMenuOpen(false) }}>{mode === 'visual' ? 'Use ChordPro Editor' : 'Use Visual Editor'}</button>
                    <button type="button" role="menuitem" onClick={() => { downloadCho(editor.song); setMenuOpen(false) }}>Download as ChordPro</button>
                    <button type="button" role="menuitem" onClick={() => { copyShare(editor.song, announce); setMenuOpen(false) }}>Copy Share Link</button>
                    <button type="button" role="menuitem" onClick={() => { if (view) setPerformance({ mode: 'projector', songs: [view] }); setMenuOpen(false) }}>Projector View</button>
                    <button type="button" role="menuitem" onClick={() => { void deleteCurrentSong() }}>Delete song</button>
                  </div>
                )}
              </div>
            
          </header>
          <div className={mode === 'chordpro' ? 'editor-body chordpro-mode' : 'editor-body'}>
            {mode === 'chordpro' && <ChordProPane song={editor.song} onApply={(text) => setEditor((state) => state ? applyChordProOf(state, text) : state)} />}
            <div className="editor-scroll">
              <div className="song-hero">
                <DetailField className="title-input" label="Title" value={editor.song.title} onCommit={(title) => setEditor(setSongDetails(editor, { title }))} />
                <DetailField className="artist-input" label="Artist" placeholder="Artist" value={editor.song.artist ?? ''} onCommit={(artist) => setEditor(setSongDetails(editor, { artist }))} />
              </div>
              <div className="transport">
                <div className="transport-main">
                  <div className="pill" role="group" aria-label="Transpose">
                    <button className="pill-btn" type="button" aria-label="Key down a semitone" onClick={() => setEditor(stepConcert(editor, -1))}>−</button>
                    <select className="pill-select pill-key" aria-label="Key" value={formatKey(editor.concert)} onChange={(event) => setEditor(chooseConcert(editor, parseKey(event.target.value)))}>
                      <optgroup label="Major">{keyOptions(settings.prefs).map((key) => <option key={key}>{key}</option>)}</optgroup>
                      <optgroup label="Minor">{keyOptions(settings.prefs).map((key) => <option key={`${key}m`}>{key}m</option>)}</optgroup>
                    </select>
                    <button className="pill-btn" type="button" aria-label="Key up a semitone" onClick={() => setEditor(stepConcert(editor, 1))}>+</button>
                    <span className="pill-divider" aria-hidden="true" />
                    <label className="pill-capo">
                      <span className="pill-capo-label">Capo</span>
                      <select className="pill-select" aria-label="Capo" value={editor.capo} onChange={(event) => setEditor(chooseCapo(editor, Number(event.target.value)))}>
                        {Array.from({ length: 12 }, (_, capo) => <option key={capo} value={capo}>{capo === 0 ? 'None' : capo}</option>)}
                      </select>
                    </label>
                    <span className="pill-divider" aria-hidden="true" />
                    <button
                      className="pill-btn pill-icon"
                      type="button"
                      aria-label="Reset transpose"
                      disabled={!viewDirty}
                      onClick={() => { setEditor(resetView(editor)); announce('Reset key and capo') }}
                    >
                      <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="pill" role="group" aria-label="Accidental spelling">
                    <button
                      className="pill-btn"
                      type="button"
                      aria-label="Prefer flats"
                      aria-pressed={accidentalBias(settings.prefs) === 'flats'}
                      onClick={() => applyPrefs(chooseAccidentalBias(settings.prefs, 'flats'))}
                    >
                      ♭
                    </button>
                    <span className="pill-divider" aria-hidden="true" />
                    <button
                      className="pill-btn"
                      type="button"
                      aria-label="Prefer sharps"
                      aria-pressed={accidentalBias(settings.prefs) === 'sharps'}
                      onClick={() => applyPrefs(chooseAccidentalBias(settings.prefs, 'sharps'))}
                    >
                      ♯
                    </button>
                  </div>
                  <div className="transport-mode">
                    <div className="pill" role="group" aria-label="Nashville numbers">
                      <button className="pill-btn" type="button" aria-pressed={editor.nashville} onClick={() => setEditor({ ...editor, nashville: !editor.nashville })}>1-4-5</button>
                    </div>
                    {issues.length > 0 ? (
                      <button
                        className="check-mark warn"
                        type="button"
                        aria-label={issues.length === 1 ? '1 chord to check' : `${issues.length} chords to check`}
                        title="Show the first chord to check"
                        onClick={() => setEditor(selectChord(editor, issues[0].id))}
                      >
                        <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
                        {issues.length}
                      </button>
                    ) : (
                      <span className="check-mark ok" role="img" aria-label="All chords valid" title="All chords valid">
                        <Check size={15} strokeWidth={2.25} aria-hidden="true" />
                      </span>
                    )}
                    {meter && <span className="meter">{meter}</span>}
                  </div>
                </div>
                {transposed && (
                  <div className="transport-status">
                    <span className="chip">From {formatKey(editor.song.originalKey)}</span>
                    <button className="text-button" type="button" onClick={() => { setEditor(saveConcertAsSongKey(editor)); announce(`Saved in ${formatKey(editor.concert)}`) }}>Save as song key</button>
                  </div>
                )}
              </div>
              <PhoneDetails phone={phone}>
              <div className="properties">
                <span className="meta">Tempo</span>
                <DetailField label="Tempo" value={editor.song.tempo ? String(editor.song.tempo) : ''} onCommit={(tempo) => { const value = Number(tempo); setEditor(setSongDetails(editor, { tempo: tempo.trim() && Number.isFinite(value) ? value : undefined })) }} />
                <span className="meta">Time</span>
                <DetailField label="Time signature" value={editor.song.timeSignature ?? ''} onCommit={(timeSignature) => setEditor(setSongDetails(editor, { timeSignature }))} />
                <span className="meta">Writers</span>
                <DetailField label="Writers" value={editor.song.writers ?? ''} onCommit={(writers) => setEditor(setSongDetails(editor, { writers }))} />
                <span className="meta">CCLI</span>
                <DetailField label="CCLI number" value={editor.song.ccli ?? ''} onCommit={(ccli) => setEditor(setSongDetails(editor, { ccli }))} />
                <span className="meta">Notes</span>
                <DetailField label="Notes" value={editor.song.notes ?? ''} onCommit={(notes) => setEditor(setSongDetails(editor, { notes }))} />
                <span className="meta">Original key</span>
                <DetailField label="Original key" value={formatKey(editor.song.originalKey)} onCommit={(text) => { try { setEditor(setSongDetails(editor, { originalKey: parseKey(text) })) } catch { announce(`‘${text}’ isn't a key`) } }} />
              </div>
              </PhoneDetails>
              <div className="arrangement" role="group" aria-label="Arrangement">
                <span className="transport-label">Order</span>
                {editor.song.arrangement.map((item, index) => {
                  const section = editor.song.sections.find((candidate) => candidate.id === item.sectionId)
                  if (!section) return null
                  const times = item.repeat ?? 1
                  return (
                    <Fragment key={`${item.sectionId}-${index}`}>
                      {index > 0 && <span className="arrangement-sep" aria-hidden="true">·</span>}
                      <button className="arrangement-item" type="button" title="Click to repeat" onClick={() => setEditor(repeatArrangementOf(editor, index, times >= 4 ? 1 : times + 1))}>
                        {section.label}{times > 1 ? ` ×${times}` : ''}
                      </button>
                    </Fragment>
                  )
                })}
              </div>
              {editor.capo > 0 && <p className="capo-banner">Capo {editor.capo} · showing {formatKey(shapeKey).replace(/m$/, '')} shapes · sounds in {formatKey(editor.concert)}</p>}
              <Chart
                song={mode === 'chordpro' ? editor.song : settings.normalise ? mapSymbols(view, normaliseSymbol) : view}
                shapeKey={mode === 'chordpro' ? editor.song.originalKey : shapeKey}
                numbers={editor.nashville}
                selectedIds={editor.selectedIds}
                readOnly={false}
                onSelect={(id, shift) => setEditor((state) => state && selectChord(state, id, shift))}
                onAdd={(lineId, index) => {
                  const next = addAt(editor, lineId, index)
                  setEditor(next)
                  setFocusSignal((value) => value + 1)
                  announce('Chord added')
                }}
                onCheck={(lineId) => setEditor(checkLine(editor, lineId))}
                onRename={(sectionId, label) => setEditor(renameSectionOf(editor, sectionId, label))}
                onDuplicate={(sectionId) => setEditor(duplicateSectionOf(editor, sectionId))}
                onDeleteSection={(sectionId) => {
                  const label = editor.song.sections.find((section) => section.id === sectionId)?.label
                  setEditor(deleteSectionOf(editor, sectionId))
                  announce(label ? `Deleted ${label}` : 'Deleted section')
                }}
                onMoveSection={(sectionId, direction) => setEditor(moveSectionOf(editor, sectionId, direction))}
                onPlaceSection={(sectionId, index) => setEditor(placeSectionOf(editor, sectionId, index))}
                onAddSection={(kind, label) => setEditor(addSectionOf(editor, kind, label))}
                onAddNote={(sectionId, text) => setEditor((state) => state && addCommentOf(state, sectionId, text))}
                onEditNote={(lineId, text) => setEditor((state) => state && editNoteOf(state, lineId, text))}
                onRemoveLine={(lineId) => { setEditor((state) => state && removeLineOf(state, lineId)); announce('Note removed') }}
                onAddBar={(sectionId, lineId) => { setEditor(addBarChordOf(editor, sectionId, lineId)); announce('Chord added') }}
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
            {mode === 'visual' && <Inspector
              song={view}
              shapeKey={shapeKey}
              selectedId={selectedId}
              concertLabel={concertLabel}
              focusSignal={focusSignal}
              onText={editChord}
              onReplace={replaceChord}
              onDelete={() => removeChord(editor)}
              onClose={() => setEditor(selectChord(editor, null))}
            />}
          </div>
        </main>
      )}
      {place === 'import' && <main className="editor"><ImportScreen phone={phone} shared={sharedPaste} onCancel={() => { setSharedPaste(null); setPlace(phone ? 'songs' : 'editor') }} onSave={(song) => { setSharedPaste(null); void library.current.saveSong(song); setSongs((current) => [song, ...current.filter((item) => item.id !== song.id)]); const opened = openEditor(song); setEditor({ ...opened, prefs: settings.prefs }); setPlace('editor') }} /></main>}
      {place === 'sets' && <main className="editor"><SetlistScreen songs={songs} setlists={setlists} onCreate={() => { const setlist: Setlist = { id: crypto.randomUUID(), name: '', date: '', entries: [] }; setSetlists((current) => [...current, setlist]); void library.current.saveSetlist(setlist) }} onChange={(setlist) => { setSetlists((current) => current.map((item) => item.id === setlist.id ? setlist : item)); void library.current.saveSetlist(setlist) }} onDelete={(id) => { setSetlists((current) => current.filter((item) => item.id !== id)); void library.current.deleteSetlist(id) }} onExport={(setlist) => { setSetlistPrefs(settings.prefs); setSetlistExport(setlist) }} onStage={(setlist) => { const ordered = setlist.entries.flatMap((entry) => { const song = songs.find((item) => item.id === entry.songId); return song ? [{ song, concert: entry.key ?? song.originalKey, capo: entry.capo ?? 0 }] : [] }); if (ordered.length > 0) setPerformance({ mode: 'stage', entries: ordered, nashville: false }) }} /></main>}
      {place === 'settings' && <main className="editor"><SettingsScreen settings={settings} onChange={(next) => { setSettings(next); void library.current.saveSettings(next); document.documentElement.dataset.theme = next.theme === 'system' ? '' : next.theme; document.documentElement.dataset.size = next.textSize; try { localStorage.setItem('csm-theme', next.theme) } catch { /* ignore */ } setEditor((state) => state && { ...state, prefs: next.prefs, concert: keyFromPitch(notePitch(state.concert.tonic), state.concert.mode, next.prefs) }) }} onBackup={() => { const backup: BackupFile = { version: 1, songs, setlists, settings }; const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'chord-sheet-backup.json'; link.click(); URL.revokeObjectURL(url) }} onRestore={(file) => void restoreBackup(file)} /></main>}
      {place === 'editor' && layout && <PreviewPane layout={layout} />}
      {exportOpen && layout && <ExportDialog layout={layout} choices={pdfChoices} accidentals={accidentalBias(editor?.prefs ?? settings.prefs)} issueCount={issues.length} onChange={setPdfChoices} onAccidentals={(bias) => applyPrefs(prefsForBias(bias))} onClose={() => setExportOpen(false)} onDownload={() => void exportPdf()} />}
      {setlistExport && setlistLayout && <SetlistExportDialog fileName={setlistFileName(setlistExport)} layout={setlistLayout} choices={pdfChoices} accidentals={accidentalBias(setlistPrefs)} onChange={setPdfChoices} onAccidentals={(bias) => setSetlistPrefs(prefsForBias(bias))} onClose={() => setSetlistExport(null)} onDownload={() => void exportSetlist()} />}
      {performance?.mode === 'stage' && <StageView entries={performance.entries} nashville={performance.nashville} prefs={settings.prefs} onExit={() => setPerformance(null)} />}
      {performance?.mode === 'projector' && performance.songs[0] && <ProjectorView song={performance.songs[0]} onExit={() => setPerformance(null)} />}
      <div className="phone-tabs">
        <button type="button" aria-pressed={songsTabActive} onClick={() => setPlace('songs')}>Songs</button>
        <button type="button" aria-pressed={place === 'sets'} onClick={() => setPlace('sets')}>Setlists</button>
        <button type="button" aria-pressed={place === 'settings'} onClick={() => setPlace('settings')}>Settings</button>
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

function setlistFileName(setlist: Setlist): string {
  return `${[setlistName(setlist), setlist.date].filter(Boolean).join(' - ')}.pdf`
}

function downloadCho(song: Song) {
  const blob = new Blob([toChordPro(song)], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${song.title}.cho`
  link.click()
  URL.revokeObjectURL(url)
}

function copyShare(song: Song, announce: (message: string) => void) {
  const encoded = encodeShare(song)
  if (!encoded.ok) {
    announce('This song is too large for a link')
    return
  }
  void navigator.clipboard.writeText(`${location.origin}${location.pathname}#${encoded.hash}`)
  announce('Share link copied')
}

function meterLabel(song: Song): string | null {
  const parts: string[] = []
  if (song.timeSignature?.trim()) parts.push(song.timeSignature.trim())
  if (song.tempo) parts.push(`${song.tempo} BPM`)
  return parts.length > 0 ? parts.join(' · ') : null
}

function PhoneDetails({ phone, children }: { phone: boolean; children: ReactNode }) {
  if (!phone) return <>{children}</>
  return (
    <details className="song-details">
      <summary>Details</summary>
      {children}
    </details>
  )
}

function DetailField({ label, value, onCommit, className = 'field', placeholder }: { label: string; value: string; onCommit: (value: string) => void; className?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      className={className}
      aria-label={label}
      placeholder={placeholder}
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
