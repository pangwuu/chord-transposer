import { parseChord, shiftKey, type Key, type SpellingPrefs, DEFAULT_PREFS } from './chord'
import { fromChordPro } from './chordpro'
import {
  addBarChord,
  addChord,
  addLine,
  addSection,
  deletePlacements,
  deleteSection,
  displayedSong,
  duplicateSection,
  editLyric,
  markLineChecked,
  movePlacementTo,
  movePlacements,
  moveSection,
  placeSection,
  nearestSymbol,
  renameSection,
  replaceAll,
  setArrangementRepeat,
  setPlacementSymbol,
  storeSymbol,
  tonicSymbol,
  createId,
  type CommentLine,
  type SectionKind,
  type Song,
} from './song'

export type EditorState = {
  song: Song
  past: Song[]
  future: Song[]
  selectedIds: string[]
  concert: Key
  capo: number
  nashville: boolean
  prefs: SpellingPrefs
}

const LIMIT = 100

export function openEditor(song: Song): EditorState {
  return {
    song,
    past: [],
    future: [],
    selectedIds: [],
    concert: song.originalKey,
    capo: 0,
    nashville: false,
    prefs: DEFAULT_PREFS,
  }
}

function commit(state: EditorState, song: Song): EditorState {
  return { ...state, song, past: [...state.past, state.song].slice(-LIMIT), future: [] }
}

export function viewSong(state: EditorState): Song {
  return displayedSong(state.song, state.concert, state.capo, state.prefs)
}

export function undo(state: EditorState): EditorState {
  const previous = state.past[state.past.length - 1]
  if (!previous) return state
  return { ...state, song: previous, past: state.past.slice(0, -1), future: [state.song, ...state.future] }
}

export function redo(state: EditorState): EditorState {
  const next = state.future[0]
  if (!next) return state
  return { ...state, song: next, future: state.future.slice(1), past: [...state.past, state.song].slice(-LIMIT) }
}

export function selectChord(state: EditorState, id: string | null, shift = false): EditorState {
  if (!id) return { ...state, selectedIds: [] }
  if (!shift) return { ...state, selectedIds: [id] }
  const selected = state.selectedIds.includes(id) ? state.selectedIds.filter((item) => item !== id) : [...state.selectedIds, id]
  return { ...state, selectedIds: selected }
}

export function nudge(state: EditorState, how: 'left' | 'right' | 'word-left' | 'word-right' | 'start' | 'end'): EditorState {
  if (state.selectedIds.length === 0) return state
  return commit(state, movePlacements(state.song, state.selectedIds, how))
}

export function moveChord(state: EditorState, id: string, lineId: string, index: number): EditorState {
  return { ...commit(state, movePlacementTo(state.song, id, lineId, index)), selectedIds: [id] }
}

export function addAt(state: EditorState, lineId: string, index: number): EditorState {
  const view = viewSong(state)
  const line = view.sections.flatMap((section) => section.lines).find((item) => item.id === lineId)
  const fallback = tonicSymbol(shiftKey(state.concert, -state.capo, state.prefs))
  const displayed = line && line.type === 'lyric' ? nearestSymbol(line, index, fallback) : fallback
  const symbol = storeSymbol(displayed, state.song, state.concert, state.capo)
  const added = addChord(state.song, lineId, index, symbol)
  return { ...commit(state, added.song), selectedIds: [added.id] }
}

export function setChordText(state: EditorState, id: string, text: string): EditorState {
  const parsed = parseChord(text)
  const symbol = storeSymbol(parsed, state.song, state.concert, state.capo)
  return commit(state, setPlacementSymbol(state.song, id, symbol))
}

export function removeSelected(state: EditorState): EditorState {
  if (state.selectedIds.length === 0) return state
  return { ...commit(state, deletePlacements(state.song, state.selectedIds)), selectedIds: [] }
}

export function replaceSelected(state: EditorState, text: string): { state: EditorState; count: number } {
  const id = state.selectedIds[0]
  if (!id) return { state, count: 0 }
  const view = viewSong(state)
  const current = view.sections.flatMap((section) => section.lines).flatMap((line) => (line.type === 'lyric' ? line.chords : line.type === 'bars' ? line.items.flatMap((item) => (item.kind === 'chord' ? [{ id: item.id, symbol: item.symbol }] : [])) : [])).find((chord) => chord.id === id)
  if (!current) return { state, count: 0 }
  const match = storeSymbol(current.symbol, state.song, state.concert, state.capo)
  const replacement = storeSymbol(parseChord(text), state.song, state.concert, state.capo)
  const replaced = replaceAll(state.song, match, replacement)
  return { state: commit(state, replaced.song), count: replaced.count }
}

export function changeLyric(state: EditorState, lineId: string, text: string): EditorState {
  return commit(state, editLyric(state.song, lineId, text))
}

export function checkLine(state: EditorState, lineId: string): EditorState {
  return commit(state, markLineChecked(state.song, lineId))
}

export function stepConcert(state: EditorState, delta: number): EditorState {
  return { ...state, concert: shiftKey(state.concert, delta, state.prefs) }
}

export function chooseConcert(state: EditorState, key: Key): EditorState {
  return { ...state, concert: key }
}

export function chooseCapo(state: EditorState, capo: number): EditorState {
  return { ...state, capo: Math.max(0, Math.min(11, capo)) }
}

export function renameSectionOf(state: EditorState, sectionId: string, label: string): EditorState {
  const next = label.trim()
  const current = state.song.sections.find((section) => section.id === sectionId)
  if (!current || next.length === 0 || current.label === next) return state
  return commit(state, renameSection(state.song, sectionId, next))
}

export function addSectionOf(state: EditorState, kind: SectionKind, label: string): EditorState {
  return commit(state, addSection(state.song, kind, label))
}

export function duplicateSectionOf(state: EditorState, sectionId: string): EditorState {
  const song = duplicateSection(state.song, sectionId)
  if (song === state.song) return state
  return commit(state, song)
}

export function deleteSectionOf(state: EditorState, sectionId: string): EditorState {
  if (!state.song.sections.some((section) => section.id === sectionId)) return state
  return commit(state, deleteSection(state.song, sectionId))
}

export function placeSectionOf(state: EditorState, sectionId: string, index: number): EditorState {
  const song = placeSection(state.song, sectionId, index)
  if (song === state.song) return state
  return commit(state, song)
}

export function moveSectionOf(state: EditorState, sectionId: string, direction: -1 | 1): EditorState {
  const song = moveSection(state.song, sectionId, direction)
  if (song === state.song) return state
  return commit(state, song)
}

export function repeatArrangementOf(state: EditorState, index: number, repeat: number): EditorState {
  const song = setArrangementRepeat(state.song, index, repeat)
  if (song === state.song) return state
  return commit(state, song)
}

export function addCommentOf(state: EditorState, sectionId: string, text: string): EditorState {
  const comment = text.trim()
  if (!comment) return state
  const line: CommentLine = { id: createId(), type: 'comment', text: comment }
  return commit(state, addLine(state.song, sectionId, line))
}

export function addBarChordOf(state: EditorState, sectionId: string, lineId: string | null): EditorState {
  const song = addBarChord(state.song, sectionId, lineId)
  if (song === state.song) return state
  return commit(state, song)
}

export function addBarsOf(state: EditorState, sectionId: string, text: string): EditorState {
  const probe = fromChordPro(`{title: Bars}\n{key: C}\n${text}\n`)
  const line = probe.sections[0]?.lines[0]
  if (!line || line.type !== 'bars') return state
  line.id = createId()
  line.items = line.items.map((item) => ({ ...item, id: createId() }))
  return commit(state, addLine(state.song, sectionId, line))
}

export function applyChordProOf(state: EditorState, text: string): EditorState {
  try {
    const parsed = fromChordPro(text)
    if (parsed.sections.length === 0) return state
    const song: Song = {
      ...parsed,
      id: state.song.id,
      views: state.song.views,
      notes: state.song.notes,
      updatedAt: new Date().toISOString(),
    }
    return commit(state, song)
  } catch {
    return state
  }
}

export function setSongDetails(
  state: EditorState,
  details: Partial<Pick<Song, 'title' | 'artist' | 'writers' | 'tempo' | 'timeSignature' | 'ccli' | 'notes' | 'originalKey'>>,
): EditorState {
  const song: Song = { ...state.song, ...details, updatedAt: new Date().toISOString() }
  const same = (Object.keys(details) as (keyof typeof details)[]).every((key) => state.song[key] === details[key])
  if (same) return state
  return commit(state, song)
}

export function saveConcertAsSongKey(state: EditorState): EditorState {
  const concertChords = displayedSong(state.song, state.concert, 0, state.prefs)
  const song: Song = { ...concertChords, originalKey: state.concert, updatedAt: new Date().toISOString() }
  return commit({ ...state, concert: state.concert }, song)
}
