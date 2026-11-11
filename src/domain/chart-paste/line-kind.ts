import { parseChord } from '../chord'

export type ChordLine = {
  kind: 'chords'
  /** The line with annotations blanked and chord tokens tidied. Every column is unchanged. */
  text: string
  chords: number
  notes: string[]
  bars: boolean
}

export type HeadingLine = {
  kind: 'heading'
  label: string
  repeat: number
  chordLine: ChordLine | null
}

export type LineKind = { kind: 'blank' } | { kind: 'tab' } | { kind: 'lyric' } | HeadingLine | ChordLine

const REST = /^[-/x]$/
const ANNOTATION = /^\(?(?:[x×]\s*\d+|\d+\s*[x×])\)?$/i
const MARKER = /^(?:\*+|%)$/
const CHORD_SHAPED = /^[A-H](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M)?\d*$/

const SECTION_WORD =
  'intro|verse|chorus|refrain|pre[- ]?chorus|post[- ]?chorus|bridge|tag|hook|vamp|coda|break|solo|turnaround|instrumental|interlude|outro|ending|middle ?8'
const SECTION_LEAD = '(?:instrumental|guitar|piano|keys|final|last)\\s+'
const HEADING = new RegExp(
  `^[\\[(]?\\s*(?:repeat\\s+(?:the\\s+)?)?((?:${SECTION_LEAD})?(?:${SECTION_WORD})(?:\\s*\\d+[a-z]?)?)\\s*[\\])]?\\s*(?:\\(?\\s*(?:[x×]\\s*(\\d+)|(\\d+)\\s*[x×])\\s*[\\])]?)?\\s*(?:[:.\\-–—]\\s*)?(.*)$`,
  'i',
)

/** Remove what sits around a chord: `G*`, `(G)`, `Bb(add9)`. */
function tidyChord(token: string): string {
  const unstarred = token.replace(/\*+$/, '')
  const unwrapped = /^\(.*\)$/.test(unstarred) ? unstarred.slice(1, -1) : unstarred
  return unwrapped.replace(/\(([^()]+)\)/g, '$1')
}

function isChord(token: string): boolean {
  const symbol = parseChord(token)
  if (symbol.kind === 'nc') return true
  if (!/^[A-H]/.test(token)) return false
  return symbol.kind === 'chord' || CHORD_SHAPED.test(token)
}

export function isTabLine(line: string): boolean {
  const trimmed = line.trim()
  if (/^[eEbBaAdDgG]\|[-0-9xhpbr/\\|~^]+/.test(trimmed)) return true
  return /^\|?[-0-9x]{3,}/.test(trimmed) && trimmed.includes('-')
}

function parseChordLine(raw: string): ChordLine | null {
  let text = raw
  let chords = 0
  const notes: string[] = []
  const unknown: string[] = []
  const replace = (start: number, length: number, value: string) => {
    text = text.slice(0, start) + value.padEnd(length) + text.slice(start + length)
  }
  for (const match of raw.matchAll(/[^\s|]+/g)) {
    const token = match[0]
    if (REST.test(token)) continue
    if (ANNOTATION.test(token)) {
      notes.push(token.replace(/[()]/g, ''))
      replace(match.index, token.length, '')
      continue
    }
    if (MARKER.test(token)) {
      replace(match.index, token.length, '')
      continue
    }
    const tidy = tidyChord(token)
    if (isChord(tidy)) {
      chords += 1
      replace(match.index, token.length, tidy)
    } else {
      unknown.push(tidy)
    }
  }
  if (chords === 0) return null
  if (unknown.length > 0) {
    const mostlyChords = chords >= 2 && chords / (chords + unknown.length) >= 2 / 3
    if (!mostlyChords || unknown.some((token) => !/^[A-H]/.test(token))) return null
  }
  return { kind: 'chords', text: text.trimEnd(), chords, notes, bars: raw.includes('|') }
}

function tidyLabel(label: string): string {
  const single = label.replace(/\s+/g, ' ').trim()
  if (single !== single.toUpperCase() && single !== single.toLowerCase()) return single
  return single.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, gap: string, letter: string) => gap + letter.toUpperCase())
}

function parseHeading(line: string): HeadingLine | null {
  const match = line.match(HEADING)
  if (!match) return null
  const rest = match[4].trim()
  const chordLine = rest ? parseChordLine(rest) : null
  if (rest && !chordLine) return null
  const trailing = chordLine?.notes.join(' ').match(/\d+/)?.[0]
  return {
    kind: 'heading',
    label: tidyLabel(match[1]),
    repeat: Number(match[2] ?? match[3] ?? trailing ?? 1) || 1,
    chordLine: chordLine && { ...chordLine, notes: [] },
  }
}

export function classifyLine(raw: string): LineKind {
  const line = raw.trim()
  if (!line) return { kind: 'blank' }
  if (isTabLine(line)) return { kind: 'tab' }
  return parseHeading(line) ?? parseChordLine(raw) ?? { kind: 'lyric' }
}
