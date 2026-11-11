import { formatKey, inferKey, parseChord } from './chord'
import { fromChordPro } from './chordpro'
import { classifyLine, type ChordLine, type LineKind } from './chart-paste/line-kind'
import { normalisePaste } from './chart-paste/normalise'
import { collapseDoubleSpacing, markNumberedStanzas, unwrapPhoneLines } from './chart-paste/reflow'
import {
  type ArrangementItem,
  type IdGen,
  type LyricLine,
  type Section,
  type Song,
  createId,
  emptySong,
  inferKind,
  issuesIn,
  symbolsIn,
} from './song'

export type ImportIssue = { line: number; raw: string }

export type ImportResult = {
  song: Song
  format: 'chordpro' | 'chords-over-lyrics' | 'inline'
  issues: ImportIssue[]
  chordCount: number
  sectionCount: number
  detectedKey: string
  keyGuessed: boolean
}

function chordTokens(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean)
}

function isRest(token: string): boolean {
  return token === '-' || token === '/' || token === 'x' || token === '|'
}

function beatsPerBar(timeSignature?: string): number {
  const match = timeSignature?.match(/^(\d+)\s*\//)
  const beats = match ? Number(match[1]) : 4
  return Number.isFinite(beats) && beats > 0 ? beats : 4
}

const PDF_CHAR = 6

export function chordTextFromPdfItems(items: { str: string; x: number; y: number }[]): string {
  const rows: { y: number; parts: { x: number; str: string }[] }[] = []
  for (const item of items) {
    if (!item.str.trim()) continue
    let row = rows.find((candidate) => Math.abs(candidate.y - item.y) < 3)
    if (!row) {
      row = { y: item.y, parts: [] }
      rows.push(row)
    }
    row.parts.push({ x: item.x, str: item.str })
  }
  rows.sort((a, b) => b.y - a.y)
  return rows
    .map((row) => {
      const parts = [...row.parts].sort((a, b) => a.x - b.x)
      const origin = parts[0]?.x ?? 0
      let line = ''
      for (const part of parts) {
        const column = Math.max(line.length, Math.round((part.x - origin) / PDF_CHAR))
        while (line.length < column) line += ' '
        line += part.str
      }
      return line
    })
    .join('\n')
}

export function importText(raw: string, ids: IdGen = createId): ImportResult {
  const text = normalisePaste(raw)
  if (isChordPro(text)) {
    const source = sectionsFromBracketHeadings(text)
    const song = fromChordPro(source, ids)
    const stated = /^\s*\{\s*k(?:ey)?\s*:/im.test(source)
    return summarise(guessKey(song, stated), 'chordpro', source, !stated && countChords(song) > 0)
  }
  const parsed = parsePlain(text, ids)
  return summarise(guessKey(parsed.song, false), parsed.format, text, countChords(parsed.song) > 0)
}

function isChordPro(text: string): boolean {
  if (/^\s*\{[a-z_]+(?::|\})/im.test(text)) return true
  return [...text.matchAll(/\[([^\]\n]+)\]/g)].some(({ 0: whole, 1: inner }) => {
    if (/^(ch|tab)$/i.test(inner) || classifyLine(whole).kind === 'heading') return false
    return parseChord(inner).kind !== 'invalid' && /^[A-GN]/.test(inner)
  })
}

/** `[Chorus]` is a heading to people but an unknown chord to ChordPro. fromChordPro stays strict; the import path converts. */
function sectionsFromBracketHeadings(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!/^\s*\[.*\]\s*$/.test(line)) return line
      const kind = classifyLine(line)
      return kind.kind === 'heading' ? `{start_of_${inferKind(kind.label)}: ${kind.label}}` : line
    })
    .join('\n')
}

function guessKey(song: Song, stated: boolean): Song {
  if (stated) return song
  const key = inferKey(symbolsIn(song))
  return key ? { ...song, originalKey: key } : song
}

function isInterleaved(kinds: LineKind[]): boolean {
  let single = 0
  let multi = 0
  for (const kind of kinds) {
    if (kind.kind !== 'chords' || kind.bars) continue
    // A lone chord set in from the margin sits over a particular word, so its column counts.
    if (kind.chords === 1 && !kind.text.startsWith(' ')) single += 1
    else multi += 1
  }
  return single > multi
}

type SectionNote = { repeat: number }

function parsePlain(text: string, ids: IdGen): { song: Song; format: 'inline' | 'chords-over-lyrics' } {
  const lines = markNumberedStanzas(collapseDoubleSpacing(unwrapPhoneLines(text.split('\n'))))
  const kinds = lines.map(classifyLine)
  const interleaved = isInterleaved(kinds)
  const format = interleaved ? 'inline' : 'chords-over-lyrics'
  const fragmentsKeepSpaces = interleaved && lines.some((line, index) => kinds[index].kind === 'lyric' && line.endsWith(' '))

  const song = emptySong({ sections: [], arrangement: [] }, ids)
  song.sections = []
  song.arrangement = []
  const notes = new Map<string, SectionNote>()
  let section: Section | null = null
  let open: LyricLine | null = null

  const start = (label: string, repeat: number) => {
    const created: Section = { id: ids(), kind: inferKind(label), label, lines: [] }
    section = created
    song.sections.push(created)
    notes.set(created.id, { repeat })
    return created
  }
  const current = (): Section => section ?? start('Verse 1', 1)
  const closeLine = () => {
    if (!open) return
    const finished: LyricLine = open
    open = null
    const lyric = finished.text.trimEnd()
    current().lines.push({ ...finished, text: lyric, chords: finished.chords.map((chord) => ({ ...chord, index: Math.min(chord.index, lyric.length) })) })
  }
  const pushNotes = (line: ChordLine) => {
    for (const note of line.notes) current().lines.push({ id: ids(), type: 'comment', text: note })
  }
  const pushChordOnly = (line: ChordLine) => {
    current().lines.push(line.bars ? parseBars(line.text, ids) : barsFromChordLine(line.text, ids, beatsPerBar(song.timeSignature)))
    pushNotes(line)
  }

  for (let index = 0; index < lines.length; index += 1) {
    const kind = kinds[index]
    const raw = lines[index]
    if (kind.kind === 'blank') {
      closeLine()
      continue
    }
    if (kind.kind === 'heading') {
      closeLine()
      start(kind.label, kind.repeat)
      if (kind.chordLine) pushChordOnly(kind.chordLine)
      continue
    }
    if (kind.kind === 'chords') {
      const next = kinds[index + 1]
      if (kind.bars) {
        closeLine()
        pushChordOnly(kind)
        continue
      }
      if (interleaved && kind.chords === 1) {
        const chord = chordTokens(kind.text)[0]
        if (next?.kind === 'lyric') {
          const fragment = fragmentsKeepSpaces ? lines[index + 1] : lines[index + 1].trim()
          if (startsNewLine(open, fragment)) closeLine()
          open = appendFragment(open, chord, fragment, fragmentsKeepSpaces, ids)
          index += 1
        } else if (open) {
          const line: LyricLine = open
          open = { ...line, chords: [...line.chords, { id: ids(), index: line.text.trimEnd().length, symbol: parseChord(chord) }] }
        } else {
          pushChordOnly(kind)
        }
        continue
      }
      closeLine()
      if (next?.kind === 'lyric') {
        current().lines.push(alignColumns(kind.text, lines[index + 1], ids))
        pushNotes(kind)
        index += 1
      } else {
        pushChordOnly(kind)
      }
      continue
    }
    closeLine()
    if (/^repeat\b/i.test(raw.trim())) current().lines.push({ id: ids(), type: 'comment', text: raw.trim() })
    else current().lines.push({ id: ids(), type: 'lyric', text: raw.trim(), chords: [], needsCheck: false })
  }
  closeLine()
  if (song.sections.length === 0) return { song: emptySong({}, ids), format }
  foldRepeats(song, notes)
  return { song, format }
}

function startsNewLine(open: LyricLine | null, fragment: string): boolean {
  return Boolean(open) && !open?.text.endsWith(' ') && /^['"‘“(]?[A-Z]/.test(fragment.trimStart())
}

function appendFragment(open: LyricLine | null, chord: string, fragment: string, keepsSpaces: boolean, ids: IdGen): LyricLine {
  if (!open) return { id: ids(), type: 'lyric', text: fragment.trimStart(), chords: [{ id: ids(), index: 0, symbol: parseChord(chord) }], needsCheck: false }
  const separator = keepsSpaces || open.text.endsWith(' ') || fragment.startsWith(' ') ? '' : ' '
  const index = open.text.length + separator.length
  return { ...open, text: `${open.text}${separator}${fragment}`, chords: [...open.chords, { id: ids(), index, symbol: parseChord(chord) }] }
}

/** Chord columns count from the lyric's own first letter, and a chord past the end keeps its column. */
function alignColumns(chordLine: string, rawLyric: string, ids: IdGen): LyricLine {
  const indent = rawLyric.length - rawLyric.trimStart().length
  const chords: LyricLine['chords'] = []
  for (const match of chordLine.matchAll(/\S+/g)) {
    if (isRest(match[0])) continue
    chords.push({ id: ids(), index: Math.max(0, match.index - indent), symbol: parseChord(match[0]) })
  }
  const lyric = rawLyric.trim()
  const last = chords.at(-1)?.index ?? 0
  return { id: ids(), type: 'lyric', text: last > lyric.length ? lyric.padEnd(last) : lyric, chords, needsCheck: false }
}

function sectionSignature(section: Section): string {
  const chordName = (symbol: LyricLine['chords'][number]['symbol']) => (symbol.kind === 'chord' ? symbol.chord.raw : symbol.raw)
  return JSON.stringify([
    section.kind,
    section.label.toLowerCase().replace(/\s*\d+[a-z]?$/, ''),
    section.lines.map((line) => {
      if (line.type === 'comment') return ['c', line.text]
      if (line.type === 'lyric') return ['l', line.text.trim().toLowerCase(), line.chords.map((chord) => [chord.index, chordName(chord.symbol)])]
      return ['b', line.items.map((item) => (item.kind === 'chord' ? chordName(item.symbol) : item.kind))]
    }),
  ])
}

const REFERABLE_KINDS = new Set(['chorus', 'prechorus', 'bridge', 'tag'])

/** A chorus written out again, or named with nothing under it, is the same chorus played again. */
function foldRepeats(song: Song, notes: Map<string, SectionNote>): void {
  const kept: Section[] = []
  const bySignature = new Map<string, string>()
  const arrangement: ArrangementItem[] = []
  for (const section of song.sections) {
    let target = section.id
    if (section.lines.length === 0) {
      const earlier = kept.find((item) => item.label.toLowerCase() === section.label.toLowerCase()) ?? (REFERABLE_KINDS.has(section.kind) ? kept.find((item) => item.kind === section.kind) : undefined)
      if (earlier) target = earlier.id
    } else {
      const signature = sectionSignature(section)
      const earlier = bySignature.get(signature)
      if (earlier) target = earlier
      else bySignature.set(signature, section.id)
    }
    if (target === section.id) kept.push(section)
    const times = notes.get(section.id)?.repeat ?? 1
    const previous = arrangement.at(-1)
    if (previous?.sectionId === target) previous.repeat = (previous.repeat ?? 1) + times
    else arrangement.push(times > 1 ? { sectionId: target, repeat: times } : { sectionId: target })
  }
  song.sections = kept
  song.arrangement = arrangement
}

function barsFromChordLine(raw: string, ids: IdGen, beats: number): import('./song').BarLine {
  if (raw.includes('|')) return parseBars(raw, ids)
  const tokens = chordTokens(raw)
  if (tokens.some((token) => isRest(token))) {
    const groups: string[] = []
    for (let index = 0; index < tokens.length; index += beats) groups.push(tokens.slice(index, index + beats).join(' '))
    return parseBars(`| ${groups.join(' | ')} |`, ids)
  }
  return parseBars(`| ${tokens.join(' | ')} |`, ids)
}

function parseBars(raw: string, ids: IdGen): import('./song').BarLine {
  const items: import('./song').BarItem[] = []
  let started = false
  for (const segment of raw.split('|')) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    if (started) items.push({ id: ids(), kind: 'bar' })
    started = true
    for (const token of tokens) {
      if (token === '-' || token === '/' || token === 'x') items.push({ id: ids(), kind: 'rest', mark: token })
      else items.push({ id: ids(), kind: 'chord', symbol: parseChord(token) })
    }
  }
  return { id: ids(), type: 'bars', items }
}

function summarise(song: Song, format: ImportResult['format'], source: string, keyGuessed: boolean): ImportResult {
  const issues: ImportIssue[] = []
  const sourceLines = source.split(/\r?\n/)
  const nextLine = new Map<string, number>()
  for (const issue of issuesIn(song)) {
    const from = nextLine.get(issue.raw) ?? 0
    let line = 0
    for (let index = from; index < sourceLines.length; index += 1) {
      if (!sourceLines[index].includes(issue.raw)) continue
      line = index + 1
      nextLine.set(issue.raw, index + 1)
      break
    }
    issues.push({ line, raw: issue.raw })
  }
  return {
    song,
    format,
    issues,
    chordCount: countChords(song),
    sectionCount: song.sections.length,
    detectedKey: formatKey(song.originalKey),
    keyGuessed,
  }
}

export function countChords(song: Song): number {
  let count = 0
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type === 'lyric') count += line.chords.length
      if (line.type === 'bars') count += line.items.filter((item) => item.kind === 'chord').length
    }
  }
  return count
}
