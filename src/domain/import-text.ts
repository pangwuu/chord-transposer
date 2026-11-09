import { formatKey, parseChord } from './chord'
import { fromChordPro } from './chordpro'
import {
  type IdGen,
  type LyricLine,
  type Section,
  type Song,
  createId,
  emptySong,
  inferKind,
  issuesIn,
} from './song'

export type ImportIssue = { line: number; raw: string }

export type ImportResult = {
  song: Song
  format: 'chordpro' | 'chords-over-lyrics' | 'inline'
  issues: ImportIssue[]
  chordCount: number
  sectionCount: number
  detectedKey: string
}

function chordTokens(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean)
}

function isRest(token: string): boolean {
  return token === '-' || token === '/' || token === 'x' || token === '|'
}

function isChordish(line: string): boolean {
  const tokens = chordTokens(line).filter((token) => token !== '|')
  return tokens.length > 0 && tokens.every((token) => isRest(token) || parseChord(token).kind !== 'invalid')
}

function isHeading(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 48 || isChordish(trimmed)) return false
  return /^(intro|verse|chorus|bridge|tag|pre-?chorus|instrumental|interlude|outro|ending)\b/i.test(trimmed)
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

export function importText(text: string, ids: IdGen = createId): ImportResult {
  if (/\{[a-z_]+(?::|\})/i.test(text) || /\[[A-Ga-g]/.test(text)) {
    const song = fromChordPro(text, ids)
    return summarise(song, 'chordpro', text)
  }
  return summarise(parsePlain(text, ids), detectPlainFormat(text), text)
}

function detectPlainFormat(text: string): 'inline' | 'chords-over-lyrics' {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  let single = 0
  let multi = 0
  for (const line of lines) {
    if (!isChordish(line) || line.includes('|')) continue
    const count = chordTokens(line).length
    if (count === 1) single += 1
    else multi += 1
  }
  return single > multi ? 'inline' : 'chords-over-lyrics'
}

function parsePlain(text: string, ids: IdGen): Song {
  const song = emptySong({ sections: [], arrangement: [] }, ids)
  song.sections = []
  song.arrangement = []
  let section: Section | null = null
  let open: LyricLine | null = null
  let pending: { raw: string; columns: boolean; chordLine: string } | null = null
  const ensure = (label = 'Verse 1') => {
    if (!section) {
      section = { id: ids(), kind: inferKind(label), label, lines: [] }
      song.sections.push(section)
      song.arrangement.push({ sectionId: section.id })
    }
    return section
  }
  const flush = () => {
    if (open && section) section.lines.push(open)
    open = null
    pending = null
  }
  const lines = text.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flush()
      continue
    }
    if (/^repeat\b/i.test(line)) {
      flush()
      ensure().lines.push({ id: ids(), type: 'comment', text: line })
      continue
    }
    if (isHeading(line)) {
      flush()
      section = { id: ids(), kind: inferKind(line), label: line, lines: [] }
      song.sections.push(section)
      song.arrangement.push({ sectionId: section.id })
      continue
    }
    if (line.includes('|') && isChordish(line)) {
      flush()
      ensure().lines.push(parseBars(line, ids))
      continue
    }
    if (isChordish(line)) {
      const tokens = chordTokens(line)
      pending = { raw: tokens[0], columns: tokens.length > 1, chordLine: rawLine.replace(/\s+$/, '') }
      continue
    }
    if (pending?.columns) {
      const chordLine = pending.chordLine
      flush()
      ensure().lines.push(alignColumns(chordLine, line, ids))
      continue
    }
    if (pending) {
      const fragment = appendFragment(open, pending.raw, line, ids)
      open = fragment
      pending = null
      continue
    }
    flush()
    ensure().lines.push({ id: ids(), type: 'lyric', text: line, chords: [], needsCheck: false })
  }
  flush()
  if (song.sections.length === 0) return emptySong({}, ids)
  const first = firstChord(song)
  if (first?.kind === 'chord') song.originalKey = parseKeySafe(first)
  return song
}

function parseKeySafe(symbol: Extract<ReturnType<typeof parseChord>, { kind: 'chord' }>): Song['originalKey'] {
  return { tonic: symbol.chord.root, mode: 'major' }
}

function firstChord(song: Song) {
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type === 'lyric') {
        const found = line.chords.find((chord) => chord.symbol.kind === 'chord')
        if (found) return found.symbol
      }
      if (line.type === 'bars') {
        const found = line.items.find((item) => item.kind === 'chord' && item.symbol.kind === 'chord')
        if (found && found.kind === 'chord') return found.symbol
      }
    }
  }
  return null
}

function appendFragment(open: LyricLine | null, chord: string, fragment: string, ids: IdGen): LyricLine {
  if (!open) {
    return { id: ids(), type: 'lyric', text: fragment, chords: [{ id: ids(), index: 0, symbol: parseChord(chord) }], needsCheck: false }
  }
  const separator = open.text.endsWith(' ') || fragment.startsWith(' ') ? '' : ' '
  const index = open.text.length + separator.length
  return {
    ...open,
    text: `${open.text}${separator}${fragment}`,
    chords: [...open.chords, { id: ids(), index, symbol: parseChord(chord) }],
  }
}

function alignColumns(chordLine: string, lyric: string, ids: IdGen): LyricLine {
  const chords: LyricLine['chords'] = []
  const pattern = /\S+/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(chordLine))) {
    if (isRest(match[0])) continue
    chords.push({
      id: ids(),
      index: Math.min(match.index, lyric.length),
      symbol: parseChord(match[0]),
    })
  }
  return { id: ids(), type: 'lyric', text: lyric, chords, needsCheck: false }
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

function summarise(song: Song, format: ImportResult['format'], source: string): ImportResult {
  const issues: ImportIssue[] = []
  const sourceLines = source.split(/\r?\n/)
  sourceLines.forEach((line, index) => {
    for (const token of chordTokens(line)) {
      const bare = token.replace(/^\[/, '').replace(/\]$/, '')
      if (!bare || bare.startsWith('{') || isRest(bare)) continue
      if (/^[A-Ga-g]/.test(bare) || bare.includes('/')) {
        const parsed = parseChord(bare)
        if (parsed.kind === 'invalid') issues.push({ line: index + 1, raw: bare })
      }
    }
  })
  for (const issue of issuesIn(song)) {
    if (!issues.some((item) => item.raw === issue.raw)) issues.push({ line: 0, raw: issue.raw })
  }
  return {
    song,
    format,
    issues,
    chordCount: countChords(song),
    sectionCount: song.sections.length,
    detectedKey: formatKey(song.originalKey),
  }
}

function countChords(song: Song): number {
  let count = 0
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type === 'lyric') count += line.chords.length
      if (line.type === 'bars') count += line.items.filter((item) => item.kind === 'chord').length
    }
  }
  return count
}
