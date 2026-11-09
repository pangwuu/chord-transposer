import {
  type ChordSymbol,
  type Key,
  type SpellingPrefs,
  DEFAULT_PREFS,
  formatSymbol,
  parseChord,
  parseKey,
  sameChord,
  shiftKey,
  signedInterval,
  suggestionsFor,
  transposeSymbol,
} from './chord'

export type SectionKind =
  | 'intro'
  | 'verse'
  | 'prechorus'
  | 'chorus'
  | 'bridge'
  | 'tag'
  | 'instrumental'
  | 'interlude'
  | 'outro'
  | 'custom'

export type ChordPlacement = {
  id: string
  index: number
  symbol: ChordSymbol
}

export type LyricLine = {
  id: string
  type: 'lyric'
  text: string
  chords: ChordPlacement[]
  needsCheck: boolean
}

export type BarItem =
  | { id: string; kind: 'chord'; symbol: ChordSymbol }
  | { id: string; kind: 'rest'; mark: '-' | '/' | 'x' }
  | { id: string; kind: 'bar' }

export type BarLine = {
  id: string
  type: 'bars'
  items: BarItem[]
}

export type CommentLine = {
  id: string
  type: 'comment'
  text: string
}

export type Line = LyricLine | BarLine | CommentLine

export type Section = {
  id: string
  kind: SectionKind
  label: string
  lines: Line[]
}

export type ArrangementItem = {
  sectionId: string
  repeat?: number
}

export type NamedView = {
  id: string
  name: string
  key: Key
  capo: number
  nashville: boolean
}

export type Song = {
  id: string
  title: string
  artist?: string
  writers?: string
  originalKey: Key
  tempo?: number
  timeSignature?: string
  ccli?: string
  notes?: string
  sections: Section[]
  arrangement: ArrangementItem[]
  views: NamedView[]
  updatedAt: string
}

export type IdGen = () => string

export function createId(): string {
  return crypto.randomUUID()
}

export function idSequence(prefix = 'id'): IdGen {
  let n = 0
  return () => `${prefix}-${++n}`
}

export function inferKind(label: string): SectionKind {
  const name = label.trim().toLowerCase()
  if (name.startsWith('intro')) return 'intro'
  if (name.startsWith('pre')) return 'prechorus'
  if (name.startsWith('verse')) return 'verse'
  if (name.startsWith('chorus')) return 'chorus'
  if (name.startsWith('bridge')) return 'bridge'
  if (name.startsWith('tag')) return 'tag'
  if (name.startsWith('instrumental') || name.startsWith('inst')) return 'instrumental'
  if (name.startsWith('interlude')) return 'interlude'
  if (name.startsWith('outro') || name.startsWith('ending')) return 'outro'
  return 'custom'
}

export function emptySong(partial: Partial<Song> & { title?: string } = {}, ids: IdGen = createId): Song {
  const sectionId = ids()
  const song: Song = {
    id: partial.id ?? ids(),
    title: partial.title ?? 'Untitled song',
    artist: partial.artist,
    writers: partial.writers,
    originalKey: partial.originalKey ?? parseKey('C'),
    tempo: partial.tempo,
    timeSignature: partial.timeSignature,
    ccli: partial.ccli,
    notes: partial.notes,
    sections: partial.sections ?? [
      {
        id: sectionId,
        kind: 'verse',
        label: 'Verse 1',
        lines: [{ id: ids(), type: 'lyric', text: '', chords: [], needsCheck: false }],
      },
    ],
    arrangement: partial.arrangement ?? [],
    views: partial.views ?? [],
    updatedAt: partial.updatedAt ?? new Date(0).toISOString(),
  }
  if (song.arrangement.length === 0) song.arrangement = song.sections.map((section) => ({ sectionId: section.id }))
  return song
}

export function lyricLines(song: Song): LyricLine[] {
  return song.sections.flatMap((section) => section.lines.filter((line): line is LyricLine => line.type === 'lyric'))
}

export function mapSymbols(song: Song, fn: (symbol: ChordSymbol) => ChordSymbol): Song {
  const next = structuredClone(song)
  for (const section of next.sections) {
    for (const line of section.lines) {
      if (line.type === 'lyric') {
        line.chords = line.chords.map((chord) => ({ ...chord, symbol: fn(chord.symbol) }))
      } else if (line.type === 'bars') {
        line.items = line.items.map((item) => (item.kind === 'chord' ? { ...item, symbol: fn(item.symbol) } : item))
      }
    }
  }
  return next
}

export function transposeSong(song: Song, semitones: number, targetKey: Key): Song {
  return mapSymbols(song, (symbol) => transposeSymbol(symbol, semitones, targetKey))
}

export function displaySemitones(song: Song, concert: Key, capo: number): number {
  return signedInterval(song.originalKey, concert) - capo
}

export function displayedSong(song: Song, concert: Key, capo: number, prefs: SpellingPrefs = DEFAULT_PREFS): Song {
  const steps = displaySemitones(song, concert, capo)
  return transposeSong(song, steps, shiftKey(concert, -capo, prefs))
}

export function storeSymbol(displayed: ChordSymbol, song: Song, concert: Key, capo: number): ChordSymbol {
  if (displayed.kind !== 'chord') return displayed
  const steps = displaySemitones(song, concert, capo)
  return transposeSymbol(displayed, -steps, song.originalKey)
}

function updateLyric(song: Song, lineId: string, fn: (line: LyricLine) => LyricLine): Song {
  const next = structuredClone(song)
  for (const section of next.sections) {
    section.lines = section.lines.map((line) => (line.type === 'lyric' && line.id === lineId ? fn(line) : line))
  }
  return next
}

export function findPlacement(song: Song, placementId: string): { section: Section; line: Line; index: number } | null {
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type === 'lyric') {
        const index = line.chords.findIndex((chord) => chord.id === placementId)
        if (index >= 0) return { section, line, index }
      } else if (line.type === 'bars') {
        const index = line.items.findIndex((item) => item.id === placementId)
        if (index >= 0) return { section, line, index }
      }
    }
  }
  return null
}

function wordStarts(text: string): number[] {
  const starts: number[] = []
  for (let i = 0; i < text.length; i++) {
    if (/\S/.test(text[i]) && (i === 0 || /\s/.test(text[i - 1]))) starts.push(i)
  }
  return starts
}

export function nudgeIndex(text: string, index: number, how: 'left' | 'right' | 'word-left' | 'word-right' | 'start' | 'end'): number {
  if (how === 'start') return 0
  if (how === 'end') return text.length
  if (how === 'left') return Math.max(0, index - 1)
  if (how === 'right') return Math.min(text.length, index + 1)
  const starts = wordStarts(text)
  if (how === 'word-left') {
    const previous = starts.filter((start) => start < index)
    return previous.length > 0 ? previous[previous.length - 1] : 0
  }
  const next = starts.find((start) => start > index)
  return next ?? text.length
}

export function movePlacements(song: Song, placementIds: string[], how: 'left' | 'right' | 'word-left' | 'word-right' | 'start' | 'end'): Song {
  const next = structuredClone(song)
  for (const section of next.sections) {
    for (const line of section.lines) {
      if (line.type !== 'lyric') continue
      line.chords = line.chords.map((chord) =>
        placementIds.includes(chord.id) ? { ...chord, index: nudgeIndex(line.text, chord.index, how) } : chord,
      )
    }
  }
  return next
}

export function movePlacementTo(song: Song, placementId: string, targetLineId: string, index: number): Song {
  const found = findPlacement(song, placementId)
  if (!found || found.line.type !== 'lyric') return song
  const placement = found.line.chords[found.index]
  const next = structuredClone(song)
  for (const section of next.sections) {
    for (const line of section.lines) {
      if (line.type !== 'lyric') continue
      line.chords = line.chords.filter((chord) => chord.id !== placementId)
      if (line.id === targetLineId) {
        const landed = { ...placement, index: Math.max(0, Math.min(line.text.length, index)) }
        line.chords = [...line.chords, landed].sort((a, b) => a.index - b.index || a.id.localeCompare(b.id))
      }
    }
  }
  return next
}

export function nearestSymbol(line: LyricLine, index: number, fallback: ChordSymbol): ChordSymbol {
  const before = line.chords.filter((chord) => chord.index <= index).sort((a, b) => b.index - a.index)[0]
  return before?.symbol ?? fallback
}

export function tonicSymbol(key: Key): ChordSymbol {
  const suggestion = suggestionsFor(key)[0]
  return parseChord(suggestion?.symbol ?? 'C')
}

export function addChord(song: Song, lineId: string, index: number, symbol: ChordSymbol, ids: IdGen = createId): { song: Song; id: string } {
  const id = ids()
  const next = updateLyric(song, lineId, (line) => ({
    ...line,
    chords: [...line.chords, { id, index: Math.max(0, Math.min(line.text.length, index)), symbol }].sort((a, b) => a.index - b.index),
  }))
  return { song: next, id }
}

export function deletePlacements(song: Song, placementIds: string[]): Song {
  const next = structuredClone(song)
  for (const section of next.sections) {
    for (const line of section.lines) {
      if (line.type === 'lyric') line.chords = line.chords.filter((chord) => !placementIds.includes(chord.id))
      if (line.type === 'bars') line.items = line.items.filter((item) => !placementIds.includes(item.id))
    }
  }
  return next
}

export function setPlacementSymbol(song: Song, placementId: string, symbol: ChordSymbol): Song {
  const next = structuredClone(song)
  for (const section of next.sections) {
    for (const line of section.lines) {
      if (line.type === 'lyric') {
        line.chords = line.chords.map((chord) => (chord.id === placementId ? { ...chord, symbol } : chord))
      } else if (line.type === 'bars') {
        line.items = line.items.map((item) => (item.kind === 'chord' && item.id === placementId ? { ...item, symbol } : item))
      }
    }
  }
  return next
}

export function replaceAll(song: Song, match: ChordSymbol, replacement: ChordSymbol): { song: Song; count: number } {
  let count = 0
  const next = mapSymbols(song, (symbol) => {
    if (!sameChord(symbol, match)) return symbol
    count += 1
    return replacement
  })
  return { song: next, count }
}

function retarget(oldText: string, newText: string, index: number): number {
  let prefix = 0
  const limit = Math.min(oldText.length, newText.length)
  while (prefix < limit && oldText[prefix] === newText[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < oldText.length - prefix &&
    suffix < newText.length - prefix &&
    oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix += 1
  }
  if (index <= prefix) return Math.min(index, newText.length)
  if (index >= oldText.length - suffix) return Math.max(0, newText.length - (oldText.length - index))
  const oldMid = oldText.length - suffix - prefix
  const newMid = Math.max(0, newText.length - suffix - prefix)
  if (oldMid <= 0) return Math.min(prefix, newText.length)
  return Math.max(0, Math.min(newText.length, prefix + Math.round((index - prefix) * (newMid / oldMid))))
}

export function editLyric(song: Song, lineId: string, text: string): Song {
  return updateLyric(song, lineId, (line) => {
    if (line.text === text) return line
    return {
      ...line,
      text,
      needsCheck: true,
      chords: line.chords.map((chord) => ({ ...chord, index: retarget(line.text, text, chord.index) })),
    }
  })
}

export function markLineChecked(song: Song, lineId: string): Song {
  return updateLyric(song, lineId, (line) => ({ ...line, needsCheck: false }))
}

export function placementLabel(song: Song, placementId: string): string | null {
  for (const section of song.sections) {
    for (let lineNumber = 0; lineNumber < section.lines.length; lineNumber += 1) {
      const line = section.lines[lineNumber]
      if (line.type !== 'lyric') continue
      const chord = line.chords.find((item) => item.id === placementId)
      if (!chord) continue
      return `${section.label} · line ${lineNumber + 1} · over "${wordAt(line.text, chord.index)}"`
    }
  }
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type === 'bars' && line.items.some((item) => item.id === placementId)) return `${section.label} · bar line`
    }
  }
  return null
}

function wordAt(text: string, index: number): string {
  if (text.length === 0 || index >= text.length) return 'the end'
  let cursor = index
  if (/\s/.test(text[cursor])) {
    while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1
    if (cursor >= text.length) cursor = Math.max(0, index - 1)
  }
  let start = cursor
  let end = cursor
  while (start > 0 && /\S/.test(text[start - 1])) start -= 1
  while (end < text.length && /\S/.test(text[end])) end += 1
  return text.slice(start, end) || 'the line'
}

export function issuesIn(song: Song): { id: string; raw: string }[] {
  const issues: { id: string; raw: string }[] = []
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type === 'lyric') {
        for (const chord of line.chords) if (chord.symbol.kind === 'invalid') issues.push({ id: chord.id, raw: chord.symbol.raw })
      } else if (line.type === 'bars') {
        for (const item of line.items) if (item.kind === 'chord' && item.symbol.kind === 'invalid') issues.push({ id: item.id, raw: item.symbol.raw })
      }
    }
  }
  return issues
}

export function chordsUsed(song: Song): { label: string; count: number }[] {
  const counts = new Map<string, number>()
  const visit = (symbol: ChordSymbol) => {
    if (symbol.kind === 'invalid') return
    const label = formatSymbol(symbol)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type === 'lyric') line.chords.forEach((chord) => visit(chord.symbol))
      if (line.type === 'bars') line.items.forEach((item) => item.kind === 'chord' && visit(item.symbol))
    }
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function addSection(song: Song, kind: SectionKind, label: string, ids: IdGen = createId): Song {
  const section: Section = {
    id: ids(),
    kind,
    label,
    lines: [{ id: ids(), type: 'lyric', text: '', chords: [], needsCheck: false }],
  }
  return { ...structuredClone(song), sections: [...song.sections, section], arrangement: [...song.arrangement, { sectionId: section.id }] }
}

export function renameSection(song: Song, sectionId: string, label: string): Song {
  const next = structuredClone(song)
  for (const section of next.sections) {
    if (section.id === sectionId) {
      section.label = label
      section.kind = inferKind(label)
    }
  }
  return next
}

export function deleteSection(song: Song, sectionId: string): Song {
  const next = structuredClone(song)
  next.sections = next.sections.filter((section) => section.id !== sectionId)
  next.arrangement = next.arrangement.filter((item) => item.sectionId !== sectionId)
  return next
}

export function duplicateSection(song: Song, sectionId: string, ids: IdGen = createId): Song {
  const next = structuredClone(song)
  const index = next.sections.findIndex((section) => section.id === sectionId)
  if (index < 0) return song
  const copy = structuredClone(next.sections[index])
  copy.id = ids()
  copy.label = `${copy.label} copy`
  for (const line of copy.lines) {
    line.id = ids()
    if (line.type === 'lyric') line.chords = line.chords.map((chord) => ({ ...chord, id: ids() }))
    if (line.type === 'bars') line.items = line.items.map((item) => ({ ...item, id: ids() }))
  }
  next.sections.splice(index + 1, 0, copy)
  const arrangementIndex = next.arrangement.findIndex((item) => item.sectionId === sectionId)
  next.arrangement.splice(arrangementIndex + 1, 0, { sectionId: copy.id })
  return next
}

export function placeSection(song: Song, sectionId: string, index: number): Song {
  const next = structuredClone(song)
  const from = next.sections.findIndex((section) => section.id === sectionId)
  if (from < 0 || index < 0 || index >= next.sections.length || from === index) return song
  const [section] = next.sections.splice(from, 1)
  next.sections.splice(index, 0, section)
  return next
}

export function moveSection(song: Song, sectionId: string, direction: -1 | 1): Song {
  const next = structuredClone(song)
  const index = next.sections.findIndex((section) => section.id === sectionId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= next.sections.length) return song
  const [section] = next.sections.splice(index, 1)
  next.sections.splice(target, 0, section)
  return next
}

export function setArrangementRepeat(song: Song, index: number, repeat: number): Song {
  if (index < 0 || index >= song.arrangement.length) return song
  const count = Math.max(1, Math.min(8, Math.round(repeat)))
  const current = song.arrangement[index].repeat ?? 1
  if (current === count) return song
  const next = structuredClone(song)
  next.arrangement[index].repeat = count === 1 ? undefined : count
  return next
}

export function addLine(song: Song, sectionId: string, line: Line): Song {
  const next = structuredClone(song)
  const section = next.sections.find((item) => item.id === sectionId)
  if (!section) return song
  section.lines.push(line)
  return next
}

export function performance(song: Song, repeats: 'full' | 'pointer' = 'full'): { section: Section; copy: number; copies: number; pointer: boolean }[] {
  const items: ArrangementItem[] = song.arrangement.length > 0 ? song.arrangement : song.sections.map((section) => ({ sectionId: section.id }))
  const played: { section: Section; copy: number; copies: number; pointer: boolean }[] = []
  for (const item of items) {
    const section = song.sections.find((candidate) => candidate.id === item.sectionId)
    if (!section) continue
    const copies = Math.max(1, item.repeat ?? 1)
    if (repeats === 'pointer' && copies > 1) {
      played.push({ section, copy: 1, copies, pointer: true })
      continue
    }
    for (let copy = 1; copy <= copies; copy += 1) played.push({ section, copy, copies, pointer: false })
  }
  return played
}

export function searchText(song: Song): string {
  const lyrics = song.sections
    .flatMap((section) => section.lines)
    .map((line) => (line.type === 'comment' ? line.text : line.type === 'lyric' ? line.text : ''))
    .join('\n')
  return `${song.title}\n${song.artist ?? ''}\n${lyrics}`.toLowerCase()
}
