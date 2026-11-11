import { classifyLine } from './line-kind'

function lyricsEndingInSpaceAreRare(lines: string[]): boolean {
  const lyrics = lines.filter((line) => classifyLine(line).kind === 'lyric')
  return lyrics.filter((line) => line.endsWith(' ')).length * 2 <= lyrics.length
}

function isWrapped(chordRow: string, first: string, continuation: string, trustSpace: boolean): boolean {
  const head = first.trimEnd()
  const tail = continuation.trim()
  // A wrapped chord row runs out to the same width as its lyric.
  if (chordRow.length < head.length - 1) return false
  if (trustSpace && first.endsWith(' ')) return tail.length < head.length
  return /^[a-z]/.test(tail) && tail.length * 2 <= head.length && head.length >= 20 && !/[.,;:!?)]$/.test(head)
}

function mergeRows(chordRow: string, lyric: string, nextChords: string, nextLyric: string): [string, string] {
  const joined = lyric.endsWith(' ') ? lyric : `${lyric} `
  const indent = nextLyric.length - nextLyric.trimStart().length
  let row = chordRow.trimEnd()
  for (const match of nextChords.matchAll(/\S+/g)) {
    const column = joined.length + Math.max(0, match.index - indent)
    row = row.padEnd(Math.max(column, row.length + 1)) + match[0]
  }
  return [row, joined + nextLyric.trim()]
}

/** A phone copy carries the page's line wrapping: the end of a chord row and its lyric land on their own two lines. */
export function unwrapPhoneLines(lines: string[]): string[] {
  const trustSpace = lyricsEndingInSpaceAreRare(lines)
  const kindAt = (index: number) => (index < lines.length ? classifyLine(lines[index]).kind : 'blank')
  const out: string[] = []
  let index = 0
  while (index < lines.length) {
    if (kindAt(index) !== 'chords' || kindAt(index + 1) !== 'lyric') {
      out.push(lines[index])
      index += 1
      continue
    }
    let chordRow = lines[index]
    let lyric = lines[index + 1]
    let next = index + 2
    while (kindAt(next) === 'chords' && kindAt(next + 1) === 'lyric' && isWrapped(chordRow, lyric, lines[next + 1], trustSpace)) {
      ;[chordRow, lyric] = mergeRows(chordRow, lyric, lines[next], lines[next + 1])
      next += 2
    }
    out.push(chordRow, lyric)
    index = next
  }
  return out
}

/** Some copies put a blank line after every row. Judged across the paste, so a closing chord line can't take the next stanza's lyric. */
export function collapseDoubleSpacing(lines: string[]): string[] {
  const kinds = lines.map((line) => classifyLine(line).kind)
  const isChords = (index: number) => kinds[index] === 'chords'
  let direct = 0
  let gapped = 0
  lines.forEach((_, index) => {
    if (!isChords(index)) return
    if (kinds[index + 1] === 'lyric') direct += 1
    else if (kinds[index + 1] === 'blank' && kinds[index + 2] === 'lyric') gapped += 1
  })
  if (gapped < 2 || gapped < direct * 3) return lines
  return lines.filter((_, index) => !(kinds[index] === 'blank' && isChords(index - 1) && kinds[index + 1] === 'lyric'))
}

const NUMBERED = /^(\s*)(\d+)[.)](\s+)(?=\S)/

function isBareHeading(line: string | undefined): boolean {
  if (line === undefined) return false
  const kind = classifyLine(line)
  return kind.kind === 'heading' && !kind.chordLine
}

/** Hymn sites number their stanzas in the lyric. The number becomes the heading, and its width is kept so chords stay put. */
export function markNumberedStanzas(lines: string[]): string[] {
  const opensStanza = (index: number) => {
    const before = lines[index - 1]
    if (before === undefined) return true
    const kind = classifyLine(before).kind
    return kind === 'blank' || kind === 'heading'
  }
  const stanzas = lines.flatMap((line, index) => {
    if (classifyLine(line).kind !== 'lyric' || !NUMBERED.test(line)) return []
    const hasChords = index > 0 && classifyLine(lines[index - 1]).kind === 'chords'
    const top = hasChords ? index - 1 : index
    return opensStanza(top) ? [{ index, top }] : []
  })
  if (stanzas.length < 2) return lines
  const numbered = new Set(stanzas.map((stanza) => stanza.index))
  const tops = new Map(stanzas.map((stanza) => [stanza.top, stanza.index]))
  const out: string[] = []
  lines.forEach((line, index) => {
    const lyricIndex = tops.get(index)
    if (lyricIndex !== undefined && !isBareHeading(lines[index - 1])) out.push(`Verse ${lines[lyricIndex].match(NUMBERED)?.[2]}`)
    out.push(numbered.has(index) ? line.replace(NUMBERED, (whole) => ' '.repeat(whole.length)) : line)
  })
  return out
}
