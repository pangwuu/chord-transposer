import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDownUp, Check, Guitar, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { accidentalBias, chooseAccidentalBias, easyChord, formatKey, prefsForBias, formatSymbol, keyFromPitch, normaliseSymbol, notePitch, parseChord, parseKey, shiftKey, type SpellingPrefs } from '../domain/chord'
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
  takeBandmateCopy,
  undo,
  viewSong,
  type EditorState,
} from '../domain/editor'
import { applyRestore, planRestore, type BackupFile } from '../domain/backup'
import { toChordPro } from '../domain/chordpro'
import { followOrder, sameValue } from '../domain/follow-library'
import { defaultSettings, type LibraryRepository, type LibrarySnapshot, type PaneWidths, type Setlist, type Settings } from '../domain/library-types'
import { settingsFrom, type SettingsStore } from '../domain/settings-store'
import { layoutPdf, layoutSetlist } from '../domain/pdf-layout'
import { formatRoute, parseRoute, type Route } from '../domain/route'
import { bundleSetlist, encodeBundle, encodeShare, mergeBundle, readShare, type ShareBundle } from '../domain/share'
import { findPlacement, findSongs, issuesIn, mapSymbols, onlySeededSongs, unusualChords, type Song, type SongSort } from '../domain/song'
import { amazingGrace, firstLight } from '../fixtures/charts'
import { emptySong } from '../domain/song'
import { Chart, type NudgeHow } from './chart'
import { ChordProPane } from './chordpro-pane'
import { defaultPdfChoices, ExportDialog, SetlistExportDialog, type PdfChoices } from './export-dialog'
import { ImportScreen, readSharedPaste } from './import-screen'
import { Inspector } from './inspector'
import { PreviewPane } from './preview-pane'
import { fitPanes, previewVisible } from './layout-rules'
import { PaneDivider } from './pane-divider'
import { ProjectorView, StageView, type StageEntry, type StageSource } from './performance'
import { addSongToSetlist, lastPlayed, lastPlayedLabel, removeSongFromSetlists, restoreSongEntries, runningOrderText, setlistsNewestFirst, todayDate } from '../domain/setlist'
import { reportUnsaved } from './app-update'
import { runningInstalled, wantsInstallHint } from './install-hint'
import { shortcutFor } from './shortcuts'
import { ShortcutsDialog } from './shortcuts-dialog'
import { SetlistScreen, setlistName } from './setlist-screen'
import { SettingsScreen } from './settings-screen'
import type { BandControls } from './band-gate'
import { BandSettings, LeaveBandDialog } from './band-settings'

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

type Place = 'songs' | 'editor' | 'sets' | 'settings' | 'import'

/** The songs a new band starts with. A library holding only these has nothing of the band's own yet. */
const SEEDED_SONG_IDS = [amazingGrace.id, firstLight.id]

/** A short message at the foot of the screen. Only one that can be undone carries an Undo button. */
type Toast = { text: string; undo?: () => void; long?: boolean }

const TOAST_TIME = 3500
/** Long enough to notice and reach Undo after deleting a song or setlist. */
const UNDO_TOAST_TIME = 8000

const SORT_NAMES: Record<SongSort['by'], string> = { title: 'Title', added: 'Date added', edited: 'Date edited', key: 'Key' }

const NUDGES: Record<string, NudgeHow> = {
  'chord-left': 'left', 'chord-right': 'right', 'chord-word-left': 'word-left', 'chord-word-right': 'word-right', 'chord-start': 'start', 'chord-end': 'end',
}

export function App({ library, settingsStore, band }: { library: LibraryRepository; settingsStore: SettingsStore; band?: BandControls }) {
  const editorRef = useRef<EditorState | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const phone = usePhone()
  const viewport = useViewportWidth()
  const [sharedPaste, setSharedPaste] = useState(launchPaste)
  const [place, setPlace] = useState<Place>(() => (sharedPaste ? 'import' : phone ? 'songs' : 'editor'))
  const [mode, setMode] = useState<'visual' | 'chordpro'>('visual')
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickingSetlist, setPickingSetlist] = useState(false)
  const [performance, setPerformance] = useState<
    | { mode: 'stage'; entries: StageEntry[]; nashville: boolean; source: StageSource }
    | { mode: 'projector'; songs: Song[] }
    | null
  >(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [setlistExport, setSetlistExport] = useState<Setlist | null>(null)
  const [setlistPrefs, setSetlistPrefs] = useState<SpellingPrefs>(() => defaultSettings().prefs)
  const [songs, setSongs] = useState<Song[]>([])
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [openSetlistId, setOpenSetlistId] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>(() => settingsStore.read())
  const [previewPeek, setPreviewPeek] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme === 'system' ? '' : settings.theme
    root.dataset.size = settings.textSize
    root.dataset.accent = settings.accent ?? 'ink'
  }, [settings.theme, settings.textSize, settings.accent])
  const [pdfChoices, setPdfChoices] = useState<PdfChoices>(() => ({ ...defaultPdfChoices(), paper: settings.paper, fontSize: settings.lyricSize }))
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Saved')
  const [toast, setToast] = useState<Toast | null>(null)
  const [easy, setEasy] = useState(false)
  const [showUnusual, setShowUnusual] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [autoPaste, setAutoPaste] = useState(false)
  const [installed] = useState(runningInstalled)
  const [live, setLive] = useState('')
  const [focusSignal, setFocusSignal] = useState(0)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  editorRef.current = editor
  const setlistsNow = useRef(setlists)
  setlistsNow.current = setlists

  const started = useRef<ReturnType<typeof startLibrary> | null>(null)
  /** The copy of the open song last saved from here, or last taken from the band. Anything else in the editor is waiting to be saved. */
  const saved = useRef<Song | null>(null)
  useEffect(() => {
    let cancel = false
    let begun = false
    let following = false
    let latest: LibrarySnapshot | null = null
    const follow = (snapshot: LibrarySnapshot) => {
      const state = editorRef.current
      const settled = state !== null && state.song === saved.current
      const incoming = state && snapshot.songs.find((song) => song.id === state.song.id)
      // With nothing of ours waiting to be saved, a different copy of the open song is a bandmate's edit: show it.
      if (settled && incoming && !sameValue(incoming, state.song)) {
        saved.current = incoming
        setEditor((current) => (current && current.song === state.song ? takeBandmateCopy(current, incoming) : current))
      }
      // Otherwise the open song is the editor's until its save lands; a snapshot can still hold the copy before it.
      const open = settled ? null : state?.song
      setSongs((shown) => followOrder(shown, snapshot.songs.map((song) => (open && song.id === open.id ? open : song)), 'first'))
      setSetlists((shown) => followOrder(shown, snapshot.setlists, 'last'))
    }
    const fail = () => {
      if (cancel || following) return
      const list = [amazingGrace, firstLight]
      setSongs(list)
      setEditor(openEditor(list[0]))
      setReady(true)
      setStatus('Not saved')
    }
    const unsubscribe = library.subscribe((snapshot) => {
      if (cancel) return
      if (following) return follow(snapshot)
      latest = snapshot
      if (begun) return
      begun = true
      // One start per mount: a second effect run must not read the share link again.
      started.current ??= startLibrary(library, snapshot)
      started.current
        .then(({ list, held, first, landing, note, sharedSetlist }) => {
          if (cancel) return
          const wanted = landing || sharedPaste ? null : parseRoute(location.hash)
          const target = wanted ? resolveRoute(wanted, list, held, phone) : null
          setSongs(list)
          setSetlists(held)
          setOpenSetlistId(target ? target.setlistId : sharedSetlist)
          if (target) setPlace(target.place)
          else if (landing) setPlace(landing)
          const said = note ?? target?.note
          if (said) announce(said)
          const opening = target?.song ?? first
          setEditor(opening ? openEditor(opening) : null)
          if (!opening && !target) setPlace('songs')
          setReady(true)
          following = true
          if (latest) follow(latest)
        })
        .catch(fail)
    }, fail)
    return () => {
      cancel = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!ready || !editor) return
    setSongs((current) => current.map((song) => (song.id === editor.song.id ? editor.song : song)))
    if (editor.song === saved.current) return
    setStatus('Saving…')
    const timer = window.setTimeout(() => {
      saved.current = editor.song
      library.saveSong(editor.song).then(() => setStatus('Saved')).catch(() => setStatus('Not saved'))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [editor?.song, ready])

  const bandNotice = band?.notice
  useEffect(() => {
    // The app is mounted afresh for each band; a notice from before that is already old news.
    if (bandNotice && Date.now() - bandNotice.at < 4000) announce(bandNotice.text)
  }, [bandNotice])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.long ? UNDO_TOAST_TIME : TOAST_TIME)
    return () => window.clearTimeout(timer)
  }, [toast])

  // An app update reloads the page; it waits while an edit has yet to be saved.
  const unsaved = useRef(false)
  unsaved.current = status !== 'Saved'
  useEffect(() => reportUnsaved(() => unsaved.current), [])

  /** Another screen is over the editor and has the keyboard: stage, projector, or a dialog. */
  const covered = useRef(false)
  covered.current = performance !== null || shortcutsOpen || exportOpen || setlistExport !== null || leaving

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (covered.current) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return
      const state = editorRef.current
      const action = shortcutFor(event, !state ? ['Anywhere'] : state.selectedIds.length === 0 ? ['Anywhere', 'Song', 'Section'] : ['Anywhere', 'Song', 'Section', 'Selected chord'])
      if (!action) return
      if (action !== 'chord-deselect') event.preventDefault()
      if (action === 'help') return setShortcutsOpen(true)
      if (action === 'search') return searchRef.current?.focus()
      if (!state) return
      if (action === 'undo' || action === 'redo') {
        setEditor(action === 'undo' ? undo(state) : redo(state))
        announce(action === 'undo' ? 'Undid' : 'Redid')
      } else if (action === 'key-up' || action === 'key-down') {
        setEditor(stepConcert(state, action === 'key-up' ? 1 : -1))
      } else if (action === 'duplicate-section') {
        const sectionId = sectionOf(state)
        if (sectionId) setEditor(duplicateSectionOf(state, sectionId))
      } else if (action === 'section-up' || action === 'section-down') {
        const sectionId = sectionOf(state)
        if (sectionId) setEditor(moveSectionOf(state, sectionId, action === 'section-up' ? -1 : 1))
      } else if (action === 'chord-deselect') {
        setEditor(selectChord(state, null))
      } else if (action === 'chord-edit') {
        setFocusSignal((value) => value + 1)
      } else if (action === 'chord-delete') {
        removeChord(state)
      } else if (NUDGES[action]) {
        setEditor(nudge(state, NUDGES[action]))
        announce('Chord moved', undoEdit)
      }
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
      return [{ song, capo: entry.capo ?? 0, concert: keyFromPitch(notePitch(concert.tonic), concert.mode, setlistPrefs), notes: entry.notes }]
    })
    const cover = pdfChoices.coverPage ? { name: setlistName(setlistExport), date: coverDate(setlistExport.date) } : undefined
    return layoutSetlist(entries, {
      ...pdfChoices,
      numbers: settings.numbers,
      prefs: setlistPrefs,
      allowTwoColumns: settings.allowTwoColumns,
    }, false, cover)
  }, [setlistExport, songs, pdfChoices, settings.numbers, setlistPrefs, settings.allowTwoColumns])

  /** Says something at the foot of the screen. Pass `undo` only when Undo would take back exactly what was said. */
  function announce(text: string, undo?: () => void, long = false) {
    setLive(text)
    setToast({ text, undo, long })
  }

  /** Takes back the last change to the open song. */
  function undoEdit() {
    const state = editorRef.current
    if (state) setEditor(undo(state))
    setLive('Undid')
  }

  function removeChord(state: EditorState) {
    const id = state.selectedIds[0]
    const placed = id ? findPlacement(viewSong(state), id) : null
    const symbol = placed && placed.line.type === 'lyric' ? placed.line.chords[placed.index]?.symbol : null
    setEditor(removeSelected(state))
    announce(symbol ? `Deleted ${formatSymbol(symbol)}` : 'Deleted chord', undoEdit)
  }

  function editChord(text: string) {
    const state = editorRef.current
    if (!state || state.selectedIds.length !== 1 || text.trim().length === 0) return
    if (parseChord(text).kind === 'invalid') announce(`‘${text}’ isn't a recognised chord. Kept as typed.`, undoEdit)
    setEditor(setChordText(state, state.selectedIds[0], text))
  }

  function replaceChord(text: string) {
    const state = editorRef.current
    if (!state) return
    const result = replaceSelected(state, text)
    setEditor(result.state)
    announce(`Replaced ${result.count} with ${text}`, undoEdit)
  }

  async function downloadBytes(bytes: Uint8Array, name: string) {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  /** The open song's PDF as it is laid out now. */
  async function drawSongPdf(): Promise<Uint8Array> {
    if (!layout) throw new Error('No song is open')
    const [{ renderPdf }, { loadPdfFonts }] = await Promise.all([import('../domain/pdf-render'), import('./fonts')])
    return renderPdf(layout, await loadPdfFonts())
  }

  async function exportPdf() {
    if (!layout) return
    await downloadBytes(await drawSongPdf(), layout.fileName)
    setExportOpen(false)
  }

  /** The setlist's PDF: the cover page when asked for, then every song. */
  async function drawSetlistPdf(): Promise<Uint8Array> {
    if (!setlistLayout || setlistLayout.pageCount === 0) throw new Error('Nothing to export')
    const [{ renderPdf, renderCover, mergePdfs }, { loadPdfFonts }] = await Promise.all([import('../domain/pdf-render'), import('./fonts')])
    const fonts = await loadPdfFonts()
    const parts: Uint8Array[] = []
    for (const sheet of setlistLayout.sheets) {
      if (sheet.kind === 'song') parts.push(await renderPdf(sheet.layout, fonts))
      else if (sheet.kind === 'cover') parts.push(await renderCover(sheet.pages, fonts))
    }
    return mergePdfs(parts)
  }

  async function exportSetlist() {
    if (!setlistExport || !setlistLayout || setlistLayout.pageCount === 0) return
    await downloadBytes(await drawSetlistPdf(), setlistFileName(setlistExport))
    setSetlistExport(null)
  }

  async function openSong(song: Song) {
    const current = editorRef.current
    if (current) await library.saveSong(current.song)
    const opened = openEditor(song)
    setEditor({ ...opened, prefs: settings.prefs, concert: keyFromPitch(notePitch(opened.concert.tonic), opened.concert.mode, settings.prefs) })
    setPlace('editor')
  }

  function downloadBackup() {
    const backup: BackupFile = { version: 1, songs, setlists, settings }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'chord-sheet-backup.json'
    link.click()
    URL.revokeObjectURL(url)
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
    await Promise.all(next.map((song) => library.saveSong(song)))
    const restored = backup.setlists ?? []
    for (const setlist of restored) await library.saveSetlist(setlist)
    setSetlists((current) => [...current.filter((item) => !restored.some((setlist) => setlist.id === item.id)), ...restored])
    if (backup.settings) changeSettings(settingsFrom(backup.settings))
    announce('Backup restored')
  }

  // The address bar mirrors where the app is. A change made here is a new history entry.
  const address = ready ? formatRoute(routeOf(place, editor?.song.id ?? null, openSetlistId)) : null
  const addressSynced = useRef(false)
  useEffect(() => {
    if (!address) return
    if (location.hash !== address) {
      if (addressSynced.current) history.pushState(null, '', address)
      else history.replaceState(null, '', address)
    }
    addressSynced.current = true
  }, [address])

  const followAddress = useRef(() => {})
  followAddress.current = () => {
    if (ready) void readAddress()
  }
  useEffect(() => {
    const onChange = () => followAddress.current()
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])

  /** Back, forward, or an address typed into the open app. */
  async function readAddress() {
    const hash = location.hash.replace(/^#/, '')
    if (/^[12]\./.test(hash)) {
      try {
        const taken = await takeShared(hash)
        const song = taken.added[0] ?? taken.updated[0] ?? null
        if (taken.setlist) return await show({ place: 'sets', song: null, setlistId: taken.setlist.id, note: null })
        if (song) return await show({ place: 'editor', song, setlistId: null, note: null })
      } catch {
        announce('That share link could not be read')
      }
      if (address) history.replaceState(null, '', address)
      return
    }
    const route = parseRoute(location.hash)
    if (route?.place === 'join') {
      if (address) history.replaceState(null, '', address)
      band?.invite(route.invite)
      return
    }
    if (route) await show(resolveRoute(route, songs, setlists, phone))
    else if (address) history.replaceState(null, '', address)
  }

  async function show(target: RouteTarget) {
    const current = editorRef.current
    const opening = target.song && target.song.id !== current?.song.id ? target.song : null
    if (opening && current) await library.saveSong(current.song)
    // Settle the address first, so the mirror above has nothing to push.
    history.replaceState(null, '', formatRoute(routeOf(target.place, opening?.id ?? current?.song.id ?? null, target.setlistId)))
    if (opening) {
      const opened = openEditor(opening)
      setEditor({ ...opened, prefs: settings.prefs, concert: keyFromPitch(notePitch(opened.concert.tonic), opened.concert.mode, settings.prefs) })
    }
    setPlace(target.place)
    setOpenSetlistId(target.setlistId)
    if (target.note) announce(target.note)
  }

  /** Takes a share link or shared file into the library. Throws when it cannot be read. */
  async function takeShared(text: string) {
    const current = editorRef.current
    if (current) await library.saveSong(current.song)
    const taken = await takeBundle(library, { songs, setlists }, readShare(text))
    setSongs(taken.songs)
    setSetlists(taken.setlists)
    const reopened = current && taken.updated.find((song) => song.id === current.song.id)
    if (reopened) {
      const opened = openEditor(reopened)
      setEditor({ ...opened, prefs: settings.prefs, concert: keyFromPitch(notePitch(opened.concert.tonic), opened.concert.mode, settings.prefs) })
    }
    announce(taken.message)
    return taken
  }

  async function importShared(file: File) {
    try {
      await takeShared(await file.text())
    } catch {
      announce('That file is not a shared setlist')
    }
  }

  async function createSong() {
    const now = new Date().toISOString()
    const song = emptySong({ title: 'Untitled song', createdAt: now, updatedAt: now })
    await library.saveSong(song)
    setSongs((current) => [song, ...current.filter((item) => item.id !== song.id)])
    setEditor(openEditor(song))
    setPlace('editor')
  }

  function openInEditor(song: Song) {
    const opened = openEditor(song)
    setEditor({ ...opened, prefs: settings.prefs, concert: keyFromPitch(notePitch(opened.concert.tonic), opened.concert.mode, settings.prefs) })
    setPlace('editor')
  }

  /** Deletes the open song at once. The toast's Undo puts it back, in every setlist it was taken from. */
  async function deleteCurrentSong() {
    const current = editor
    if (!current) return
    const song = current.song
    const { setlists: without, removed } = removeSongFromSetlists(setlists, song.id)
    setMenuOpen(false)
    const remaining = songs.filter((item) => item.id !== song.id)
    setSongs(remaining)
    setSetlists(without)
    if (remaining[0]) openInEditor(remaining[0])
    else {
      setEditor(null)
      setPlace('songs')
    }
    await library.deleteSong(song.id)
    announce(`Deleted ‘${song.title}’`, () => void restoreSong(song, removed), true)
  }

  async function restoreSong(song: Song, removed: ReturnType<typeof removeSongFromSetlists>['removed']) {
    const current = editorRef.current
    if (current) await library.saveSong(current.song)
    await library.saveSong(song)
    setSongs((list) => [song, ...list.filter((item) => item.id !== song.id)])
    // Put it back into the setlists as they are now: one may have been edited or deleted since.
    const restored = restoreSongEntries(setlistsNow.current, removed)
    setSetlists(restored.setlists)
    for (const setlist of restored.changed) void library.saveSetlist(setlist)
    saved.current = song
    openInEditor(song)
    setLive(`Restored ‘${song.title}’`)
  }

  function deleteSetlist(id: string) {
    const gone = setlists.find((item) => item.id === id)
    setSetlists((current) => current.filter((item) => item.id !== id))
    void library.deleteSetlist(id)
    if (!gone) return
    announce(`Deleted ‘${setlistName(gone)}’`, () => {
      setSetlists((current) => [...current.filter((item) => item.id !== gone.id), gone])
      void library.saveSetlist(gone)
      setOpenSetlistId(gone.id)
      setLive(`Restored ‘${setlistName(gone)}’`)
    }, true)
  }

  function copyRunningOrder(setlist: Setlist) {
    void navigator.clipboard.writeText(runningOrderText(setlist, songs, settings.prefs))
    announce('Running order copied')
  }

  function shareRunningOrder(setlist: Setlist) {
    // Closing the share sheet without sending is not an error.
    navigator.share({ text: runningOrderText(setlist, songs, settings.prefs) }).catch(() => {})
  }

  /** Marks a one-time hint as done with on this device. */
  function dismiss(hint: keyof Settings['dismissed']) {
    const next = { ...settings, dismissed: { ...settings.dismissed, [hint]: true } }
    setSettings(next)
    settingsStore.write(next)
  }

  function changeSort(songSort: SongSort) {
    const next = { ...settings, songSort }
    setSettings(next)
    settingsStore.write(next)
  }

  /** Applies settings to this device and keeps them for the next visit. */
  function changeSettings(next: Settings) {
    setSettings(next)
    settingsStore.write(next)
    setEditor((state) => state && {
      ...state,
      prefs: next.prefs,
      concert: keyFromPitch(notePitch(state.concert.tonic), state.concert.mode, next.prefs),
    })
  }

  function applyPrefs(prefs: SpellingPrefs) {
    changeSettings({ ...settings, prefs })
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
  useEffect(() => {
    if (!menuOpen) setPickingSetlist(false)
  }, [menuOpen])

  function addOpenSongTo(setlist: Setlist | null) {
    if (!editor) return
    const target = setlist ?? { id: crypto.randomUUID(), name: '', date: '', entries: [] }
    const next = addSongToSetlist(target, editor.song, { concert: editor.concert, capo: editor.capo })
    setSetlists((current) => (setlist ? current.map((item) => (item.id === next.id ? next : item)) : [...current, next]))
    void library.saveSetlist(next)
    setMenuOpen(false)
    if (setlist) announce(`Added to ${setlistName(setlist)}`)
    else {
      setOpenSetlistId(next.id)
      setPlace('sets')
    }
  }

  const visible = findSongs(songs, query, settings.songSort)
  const issues = view ? issuesIn(view) : []
  const unusual = view && shapeKey && settings.flagUnusual ? unusualChords(view, shapeKey) : []
  const unusualOpen = showUnusual && unusual.length > 0
  const today = todayDate()
  const canShareText = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  // The first-song card is for a library with nothing of the band's own. Once it has something, the card is done for good.
  const seededOnly = onlySeededSongs(songs, SEEDED_SONG_IDS)
  const firstSongCard = ready && seededOnly && !settings.dismissed.firstSong
  useEffect(() => {
    if (ready && !seededOnly && !settings.dismissed.firstSong) dismiss('firstSong')
  }, [ready, seededOnly, settings.dismissed.firstSong])
  const installHint = ready && wantsInstallHint({ userAgent: navigator.userAgent, standalone: installed, dismissed: settings.dismissed.install })
  const transposed = editor ? formatKey(editor.concert) !== formatKey(editor.song.originalKey) : false
  const viewDirty = editor ? transposed || editor.capo > 0 : false
  const meter = editor ? meterLabel(editor.song) : null
  const selectedId = editor?.selectedIds[0] ?? null
  useEffect(() => {
    if (selectedId === null) setPreviewPeek(false)
  }, [selectedId])
  const concertLabel = editor && view && selectedId && editor.capo > 0 ? concertName(editor, selectedId) : null

  const inspectorOpen = mode === 'visual' && selectedId !== null
  const panes = fitPanes(settings.panes, { viewport, inspectorOpen })
  /** Keeps a dragged pane width for this device. `null` puts the pane back to its default. */
  function resizePane(pane: keyof PaneWidths, width: number | null) {
    const wanted = { ...settings.panes, [pane]: width ?? defaultSettings().panes[pane] }
    const next = { ...settings, panes: { ...settings.panes, [pane]: fitPanes(wanted, { viewport, inspectorOpen })[pane] } }
    setSettings(next)
    settingsStore.write(next)
  }
  const paneStyle = phone ? undefined : {
    '--library-w': `${panes.library}px`,
    '--inspector-w': `${panes.inspector}px`,
    ...(panes.preview === null ? {} : { '--preview-w': `${panes.preview}px`, '--editor-min': '0px' }),
  } as CSSProperties

  const phoneScreen = place === 'songs' ? 'songs' : place
  const phonePerformance = performance ? `phone-${performance.mode}` : ''
  const songsTabActive = place === 'songs' || place === 'editor' || place === 'import'


  return (
    <div className={['app', phone ? `phone-${phoneScreen}` : '', phonePerformance].filter(Boolean).join(' ')} style={paneStyle}>
      <aside className="library">
        {!phone && <PaneDivider label="Resize song list" edge="right" width={panes.library} onResize={(width) => resizePane('library', width)} onReset={() => resizePane('library', null)} />}
        <div className="brand"><span>Chord Sheet Maker</span></div>
        <input ref={searchRef} className="search" aria-label="Search songs" placeholder="Search songs" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="library-sort">
          <select className="select" aria-label="Sort songs" value={settings.songSort.by} onChange={(event) => changeSort({ ...settings.songSort, by: event.target.value as SongSort['by'] })}>
            {(Object.keys(SORT_NAMES) as SongSort['by'][]).map((by) => <option key={by} value={by}>{SORT_NAMES[by]}</option>)}
          </select>
          <button className="icon-button" type="button" aria-label="Reverse order" title="Reverse order" aria-pressed={settings.songSort.reverse} onClick={() => changeSort({ ...settings.songSort, reverse: !settings.songSort.reverse })}>
            <ArrowDownUp size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {phone && !firstSongCard && <button className="primary import-cta" type="button" onClick={() => setPlace('import')}>Paste a chart</button>}
        <div className="library-scroll">
          {installHint && (
            <div className="hint-card" role="note" aria-label="Add to Home Screen">
              <p><strong>Add to Home Screen</strong> to keep your band on this phone. Tap the Share button, then “Add to Home Screen”.</p>
              <button className="icon-button" type="button" aria-label="Dismiss the Home Screen hint" onClick={() => dismiss('install')}><X size={15} aria-hidden="true" /></button>
            </div>
          )}
          {firstSongCard && (
            <div className="hint-card first-song" role="note" aria-label="Bring in your first song">
              <p><strong>Bring in your first song.</strong> Copy a chart from any chord website, or a ChordPro or PDF file, and paste it here.</p>
              <button className="icon-button" type="button" aria-label="Dismiss the first song hint" onClick={() => dismiss('firstSong')}><X size={15} aria-hidden="true" /></button>
              <button className="primary" type="button" onClick={() => { setAutoPaste(phone); setPlace('import') }}>Paste a chart</button>
            </div>
          )}
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
                  onClick={() => setPerformance({ mode: 'stage', entries: [{ song: editor.song, concert: editor.concert, capo: editor.capo }], nashville: editor.nashville, source: { kind: 'song', id: editor.song.id } })}
                >
                  <Guitar size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className="bar-perform-label">Performance view</span>
                </button>
                <button className="primary" type="button" onClick={() => setExportOpen(true)}>{phone ? 'Export' : 'Export PDF'}</button>
                <button className="text-button" type="button" aria-label="More actions" aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((open) => !open)}>Menu</button>
                {menuOpen && (
                  <div className="menu editor-menu" role="menu">
                    {pickingSetlist ? (
                      <>
                        <button type="button" role="menuitem" onClick={() => setPickingSetlist(false)}>‹ Back</button>
                        <p className="menu-note">{lastPlayedLabel(lastPlayed(editor.song, setlists, today), today)}</p>
                        {setlistsNewestFirst(setlists).map((setlist) => (
                          <button key={setlist.id} type="button" role="menuitem" onClick={() => addOpenSongTo(setlist)}>
                            {setlistName(setlist)}{setlist.date && <span className="meta">{setlist.date}</span>}
                          </button>
                        ))}
                        <button type="button" role="menuitem" onClick={() => addOpenSongTo(null)}>+ New setlist</button>
                      </>
                    ) : (
                    <>
                    <button type="button" role="menuitem" onClick={() => { setEditor(undo(editor)); announce('Undid'); setMenuOpen(false) }}>Undo</button>
                    <button type="button" role="menuitem" onClick={() => { setEditor(redo(editor)); announce('Redid'); setMenuOpen(false) }}>Redo</button>
                    <button type="button" role="menuitem" onClick={() => { setMode((value) => value === 'visual' ? 'chordpro' : 'visual'); setMenuOpen(false) }}>{mode === 'visual' ? 'Use ChordPro Editor' : 'Use Visual Editor'}</button>
                    <button type="button" role="menuitem" onClick={() => { downloadCho(editor.song); setMenuOpen(false) }}>Download as ChordPro</button>
                    <button type="button" role="menuitem" onClick={() => { copyShare(editor.song, announce); setMenuOpen(false) }}>Copy Share Link</button>
                    <button type="button" role="menuitem" onClick={() => { if (view) setPerformance({ mode: 'projector', songs: [view] }); setMenuOpen(false) }}>Projector View</button>
                    <button type="button" role="menuitem" onClick={() => setPickingSetlist(true)}>Add to Setlist…</button>
                    <button type="button" role="menuitem" onClick={() => { setShortcutsOpen(true); setMenuOpen(false) }}>Keyboard shortcuts</button>
                    <button type="button" role="menuitem" onClick={() => { void deleteCurrentSong() }}>Delete song</button>
                    </>
                    )}
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
                    <div className="pill" role="group" aria-label="Easy chords">
                      <button className="pill-btn" type="button" aria-pressed={easy} title="Show plain major and minor chords. The song itself is not changed." onClick={() => setEasy((value) => !value)}>Easy</button>
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
                    {unusual.length > 0 && (
                      <button
                        className="check-mark soft"
                        type="button"
                        aria-pressed={unusualOpen}
                        aria-label={unusual.length === 1 ? '1 chord unusual for the key' : `${unusual.length} chords unusual for the key`}
                        title="Chords that are unusual for the key. Not an error: worth a second look after an import."
                        onClick={() => setShowUnusual((value) => !value)}
                      >
                        {unusual.length} unusual
                      </button>
                    )}
                    {meter && <span className="meter">{meter}</span>}
                  </div>
                </div>
                {transposed && (
                  <div className="transport-status">
                    <span className="chip">From {formatKey(editor.song.originalKey)}</span>
                    <button className="text-button" type="button" onClick={() => { setEditor(saveConcertAsSongKey(editor)); announce(`Saved in ${formatKey(editor.concert)}`, undoEdit) }}>Save as song key</button>
                  </div>
                )}
                {unusualOpen && (
                  <div className="unusual-list" role="group" aria-label="Unusual for the key">
                    <span className="meta">Unusual for {formatKey(shapeKey)}, not an error:</span>
                    {[...new Set(unusual.map((chord) => chord.label))].map((label) => (
                      <button key={label} className="chip soft" type="button" onClick={() => setEditor(selectChord(editor, unusual.find((chord) => chord.label === label)?.id ?? null))}>{label}</button>
                    ))}
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
                song={mode === 'chordpro' ? editor.song : shownChords(view, settings.normalise, easy)}
                unusualIds={unusualOpen && mode === 'visual' ? unusual.map((chord) => chord.id) : undefined}
                shapeKey={mode === 'chordpro' ? editor.song.originalKey : shapeKey}
                numbers={editor.nashville}
                selectedIds={editor.selectedIds}
                readOnly={false}
                onSelect={(id, shift) => setEditor((state) => state && selectChord(state, id, shift))}
                onAdd={(lineId, index) => {
                  const next = addAt(editor, lineId, index)
                  setEditor(next)
                  setFocusSignal((value) => value + 1)
                  announce('Chord added', undoEdit)
                }}
                onCheck={(lineId) => setEditor(checkLine(editor, lineId))}
                onRename={(sectionId, label) => setEditor(renameSectionOf(editor, sectionId, label))}
                onDuplicate={(sectionId) => setEditor(duplicateSectionOf(editor, sectionId))}
                onDeleteSection={(sectionId) => {
                  const label = editor.song.sections.find((section) => section.id === sectionId)?.label
                  setEditor(deleteSectionOf(editor, sectionId))
                  announce(label ? `Deleted ${label}` : 'Deleted section', undoEdit)
                }}
                onMoveSection={(sectionId, direction) => setEditor(moveSectionOf(editor, sectionId, direction))}
                onPlaceSection={(sectionId, index) => setEditor(placeSectionOf(editor, sectionId, index))}
                onAddSection={(kind, label) => setEditor(addSectionOf(editor, kind, label))}
                onAddNote={(sectionId, text) => setEditor((state) => state && addCommentOf(state, sectionId, text))}
                onEditNote={(lineId, text) => setEditor((state) => state && editNoteOf(state, lineId, text))}
                onRemoveLine={(lineId) => { setEditor((state) => state && removeLineOf(state, lineId)); announce('Note removed', undoEdit) }}
                onAddBar={(sectionId, lineId) => { setEditor(addBarChordOf(editor, sectionId, lineId)); announce('Chord added', undoEdit) }}
                onNudge={(how) => { setEditor(nudge(editor, how)); announce('Chord moved', undoEdit) }}
                onMove={(id, lineId, index) => {
                  const found = findPlacement(editor.song, id)
                  const placement = found && found.line.type === 'lyric' ? found.line.chords[found.index] : null
                  if (placement && found?.line.id === lineId && placement.index === index) return
                  setEditor(moveChord(editor, id, lineId, index))
                  announce('Chord moved', undoEdit)
                }}
                onEdit={() => setFocusSignal((value) => value + 1)}
                onDelete={() => removeChord(editor)}
              />
            </div>
            {!phone && inspectorOpen && <PaneDivider className="for-inspector" label="Resize chord inspector" edge="left" width={panes.inspector} onResize={(width) => resizePane('inspector', width)} onReset={() => resizePane('inspector', null)} />}
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
              phone={phone}
              previewShown={previewPeek}
              onTogglePreview={() => setPreviewPeek((value) => !value)}
              onNudge={(how) => { setEditor(nudge(editor, how)); announce('Chord moved', undoEdit) }}
            />}
          </div>
        </main>
      )}
      {place === 'import' && <main className="editor"><ImportScreen phone={phone} shared={sharedPaste} songs={songs} autoPaste={autoPaste} flagUnusual={settings.flagUnusual} onCancel={() => { setSharedPaste(null); setAutoPaste(false); setPlace(phone ? 'songs' : 'editor') }} onSave={(imported, replaces) => { const now = new Date().toISOString(); const song: Song = { ...imported, createdAt: replaces ? replaces.createdAt : now, updatedAt: now }; if (!song.createdAt) delete song.createdAt; setSharedPaste(null); setAutoPaste(false); saved.current = song; void library.saveSong(song); setSongs((current) => [song, ...current.filter((item) => item.id !== song.id)]); const opened = openEditor(song); setEditor({ ...opened, prefs: settings.prefs }); setPlace('editor'); if (replaces) announce(`Replaced ‘${replaces.title}’`) }} /></main>}
      {place === 'sets' && <main className="editor"><SetlistScreen songs={songs} setlists={setlists} sort={settings.songSort} today={today} onCopyOrder={copyRunningOrder} onShareOrder={canShareText ? shareRunningOrder : undefined} openedId={openSetlistId} onOpen={setOpenSetlistId} onShare={(setlist) => copySetlistShare(setlist, songs, announce)} onDownload={(setlist) => downloadSetlistFile(setlist, songs)} onImport={(file) => void importShared(file)} onCreate={() => { const setlist: Setlist = { id: crypto.randomUUID(), name: '', date: '', entries: [] }; setSetlists((current) => [...current, setlist]); void library.saveSetlist(setlist) }} onChange={(setlist) => { setSetlists((current) => current.map((item) => item.id === setlist.id ? setlist : item)); void library.saveSetlist(setlist) }} onDelete={deleteSetlist} onExport={(setlist) => { setSetlistPrefs(settings.prefs); setSetlistExport(setlist) }} onStage={(setlist) => { const ordered = setlist.entries.flatMap((entry) => { const song = songs.find((item) => item.id === entry.songId); return song ? [{ song, concert: entry.key ?? song.originalKey, capo: entry.capo ?? 0, notes: entry.notes }] : [] }); if (ordered.length > 0) setPerformance({ mode: 'stage', entries: ordered, nashville: false, source: { kind: 'setlist', id: setlist.id } }) }} onProject={(setlist) => { const played = setlist.entries.flatMap((entry) => songs.filter((item) => item.id === entry.songId)); if (played.length > 0) setPerformance({ mode: 'projector', songs: played }) }} /></main>}
      {place === 'settings' && <main className="editor"><SettingsScreen settings={settings} onChange={changeSettings} onShortcuts={() => setShortcutsOpen(true)} onBackup={downloadBackup} onRestore={(file) => void restoreBackup(file)} band={band && <BandSettings info={band.info} onRename={band.rename} onLeave={() => setLeaving(true)} />} /></main>}
      {leaving && band?.info && <LeaveBandDialog info={band.info} songCount={songs.length} setlistCount={setlists.length} onBackup={downloadBackup} onCancel={() => setLeaving(false)} onLeave={() => void band.leave().finally(() => setLeaving(false))} />}
      {place === 'editor' && layout && previewVisible({ phone, inspectorOpen, peek: previewPeek }) && <PreviewPane layout={layout} divider={!phone && <PaneDivider label="Resize PDF preview" edge="left" onResize={(width) => resizePane('preview', width)} onReset={() => resizePane('preview', null)} />} />}
      {exportOpen && layout && <ExportDialog layout={layout} choices={pdfChoices} accidentals={accidentalBias(editor?.prefs ?? settings.prefs)} issueCount={issues.length} onChange={setPdfChoices} onAccidentals={(bias) => applyPrefs(prefsForBias(bias))} onClose={() => setExportOpen(false)} onDownload={() => void exportPdf()} renderFile={drawSongPdf} phone={phone} onNotice={(text) => announce(text)} />}
      {setlistExport && setlistLayout && <SetlistExportDialog fileName={setlistFileName(setlistExport)} layout={setlistLayout} choices={pdfChoices} accidentals={accidentalBias(setlistPrefs)} onChange={setPdfChoices} onAccidentals={(bias) => setSetlistPrefs(prefsForBias(bias))} onClose={() => setSetlistExport(null)} onDownload={() => void exportSetlist()} renderFile={drawSetlistPdf} phone={phone} onNotice={(text) => announce(text)} />}
      {performance?.mode === 'stage' && <StageView entries={performance.entries} nashville={performance.nashville} easy={easy} source={performance.source} prefs={settings.prefs} onExit={() => setPerformance(null)} />}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {performance?.mode === 'projector' && performance.songs.length > 0 && <ProjectorView songs={performance.songs} onExit={() => setPerformance(null)} />}
      <div className="phone-tabs">
        <button type="button" aria-pressed={songsTabActive} onClick={() => setPlace('songs')}>Songs</button>
        <button type="button" aria-pressed={place === 'sets'} onClick={() => setPlace('sets')}>Setlists</button>
        <button type="button" aria-pressed={place === 'settings'} onClick={() => setPlace('settings')}>Settings</button>
      </div>
      <p className="live" aria-live="polite">{live}</p>
      {toast && (
        <div className="toast" role="status">
          {toast.text}
          {toast.undo && <button className="text-button" type="button" onClick={() => { toast.undo?.(); setToast(null) }}>Undo</button>}
        </div>
      )}
    </div>
  )
}

/** The chart as shown in the editor: one spelling per alias when asked for, then plain chords when Easy is on. */
function shownChords(view: Song, normalise: boolean, easy: boolean): Song {
  const named = normalise ? mapSymbols(view, normaliseSymbol) : view
  return easy ? mapSymbols(named, easyChord) : named
}

/** A setlist's date for its cover page, in this device's style. */
function coverDate(date: string): string {
  if (!date) return ''
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, (month || 1) - 1, day || 1))
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

function copySetlistShare(setlist: Setlist, songs: Song[], announce: (message: string) => void) {
  const encoded = encodeBundle(bundleSetlist(setlist, songs))
  if (!encoded.ok) {
    announce('This setlist is too large for a link. Download the file instead.')
    return
  }
  void navigator.clipboard.writeText(`${location.origin}${location.pathname}#${encoded.hash}`)
  announce('Share link copied')
}

function downloadSetlistFile(setlist: Setlist, songs: Song[]) {
  const blob = new Blob([JSON.stringify(bundleSetlist(setlist, songs), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${setlistName(setlist)}.setlist.json`
  link.click()
  URL.revokeObjectURL(url)
}

type RouteTarget = { place: Place; song: Song | null; setlistId: string | null; note: string | null }

function routeOf(place: Place, songId: string | null, setlistId: string | null): Route {
  if (place === 'editor') return songId ? { place: 'song', id: songId } : { place: 'songs' }
  if (place === 'sets') return setlistId ? { place: 'setlist', id: setlistId } : { place: 'setlists' }
  return { place }
}

/** Where a route leads in this library. A song or setlist that is not in it leads to the list, with a note saying so. */
function resolveRoute(route: Route, songs: Song[], setlists: Setlist[], phone: boolean): RouteTarget {
  const list: Place = phone ? 'songs' : 'editor'
  if (route.place === 'song') {
    const song = songs.find((item) => item.id === route.id) ?? null
    return { place: song ? 'editor' : list, song, setlistId: null, note: song ? null : 'That song is not in this library' }
  }
  if (route.place === 'setlist') {
    const here = setlists.some((item) => item.id === route.id)
    return { place: 'sets', song: null, setlistId: here ? route.id : null, note: here ? null : 'That setlist is not in this library' }
  }
  if (route.place === 'songs') return { place: list, song: null, setlistId: null, note: null }
  if (route.place === 'setlists') return { place: 'sets', song: null, setlistId: null, note: null }
  if (route.place === 'join') return { place: list, song: null, setlistId: null, note: null }
  return { place: route.place, song: null, setlistId: null, note: null }
}

/** Takes in a share link when the page was opened with one. A new band is seeded when it is created, not here. */
async function startLibrary(library: LibraryRepository, snapshot: LibrarySnapshot) {
  let list = snapshot.songs
  let held = snapshot.setlists
  let first: Song | undefined = list[0]
  let landing: 'editor' | 'sets' | null = null
  let note: string | null = null
  let sharedSetlist: string | null = null
  const hash = location.hash.replace(/^#/, '')
  if (/^[12]\./.test(hash)) {
    try {
      const taken = await takeBundle(library, { songs: list, setlists: held }, readShare(hash))
      list = taken.songs
      held = taken.setlists
      first = taken.added[0] ?? taken.updated[0] ?? first
      sharedSetlist = taken.setlist?.id ?? null
      if (taken.setlist) landing = 'sets'
      else if (taken.added.length + taken.updated.length > 0) landing = 'editor'
      if (taken.setlist || taken.updated.length > 0) note = taken.message
    } catch {
      note = 'That share link could not be read'
    }
    history.replaceState(null, '', location.pathname)
  }
  return { list, held, first, landing, note, sharedSetlist }
}

/** Saves what a bundle adds to the library. Asks before replacing a song or setlist already held. */
async function takeBundle(library: LibraryRepository, have: { songs: Song[]; setlists: Setlist[] }, bundle: ShareBundle) {
  const plan = mergeBundle(have, bundle)
  const changed = plan.setlist?.status === 'changed' ? plan.setlist.value : null
  const offered = [...plan.updated.map((song) => `“${song.title}”`), ...(changed ? [`setlist “${setlistName(changed)}”`] : [])]
  const replace = offered.length > 0 && window.confirm(`Replace your copy of ${offered.join(', ')} with the shared one?`)
  const updated = replace ? plan.updated : []
  const setlist = plan.setlist && (plan.setlist.status === 'new' || replace) && plan.setlist.status !== 'same' ? plan.setlist.value : null
  await Promise.all([...plan.added, ...updated].map((song) => library.saveSong(song)))
  if (setlist) await library.saveSetlist(setlist)
  const parts: string[] = []
  if (plan.setlist?.status === 'new') parts.push(`setlist “${setlistName(plan.setlist.value)}”`)
  if (plan.added.length > 0) parts.push(plan.added.length === 1 ? '1 song' : `${plan.added.length} songs`)
  const did = [parts.length > 0 ? `Added ${parts.join(' and ')}` : '', replace ? `${parts.length > 0 ? 'updated' : 'Updated'} ${offered.join(', ')}` : ''].filter(Boolean)
  return {
    songs: [...plan.added, ...have.songs.map((song) => updated.find((item) => item.id === song.id) ?? song)],
    setlists: setlist ? [...have.setlists.filter((item) => item.id !== setlist.id), setlist] : have.setlists,
    added: plan.added,
    updated,
    setlist: plan.setlist?.value ?? null,
    message: did.length > 0 ? did.join(', ') : 'Already in your library',
  }
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

function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const update = () => setWidth(window.innerWidth)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return width
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
