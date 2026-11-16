import {
  DEFAULT_PREFS,
  easyChord,
  formatKey,
  formatSymbol,
  nashville,
  shiftKey,
  type ChordSymbol,
  type Key,
  type SpellingPrefs,
} from './chord'
import { padCollisions } from './line-layout'
import { chordSummary, compactOrder, displayedSong, mapSymbols, performance, type BarItem, type Song } from './song'

export type PdfContent = 'full' | 'chords' | 'lyrics'
export type Paper = 'a4' | 'letter'

export type PdfOptions = {
  paper: Paper
  fontSize: number
  columns: 1 | 2
  fit: 'auto' | 1 | 2
  content: PdfContent
  numbers: boolean
  capo: number
  concert: Key
  prefs?: SpellingPrefs
  repeats: 'full' | 'pointer'
  allowTwoColumns: boolean
  songPosition?: { index: number; total: number }
  showArtist?: boolean
  showKey?: boolean
  showTime?: boolean
  lineSpacing?: number
  sectionLeadIn?: number
  showColumnDivider?: boolean
  showSectionDivider?: boolean
  headingSize?: number
  /** Print the plain major, minor, dim or aug chord in place of each chord. */
  easyChords?: boolean
  /** List the song's distinct chords under the header of its first page. */
  showChords?: boolean
}

export type PdfChord = { label: string; index: number; invalid: boolean }

export type PdfColumn = 1 | 2

type UntaggedBlock =
  | { kind: 'section'; label: string; continued: boolean }
  | { kind: 'lyric'; text: string; chords: PdfChord[] }
  | { kind: 'bars'; text: string }
  | { kind: 'comment'; text: string }
  | { kind: 'pointer'; text: string }

export type PdfBlock = UntaggedBlock & { column: PdfColumn }

export type PdfPage = {
  width: number
  height: number
  blocks: PdfBlock[]
  columnCount: 1 | 2
  runningHeader: string | null
  title: string
  artist: string | null
  meta: string
  capoLabel: string | null
  order: string | null
  /** The distinct chords of the song, already wrapped into lines. First page only. */
  chordsUsed: { label: string; invalid: boolean; index: number }[][] | null
  footerTitle: string
  cue: string
  pageLabel: string
}

export type PdfDocument = {
  pages: PdfPage[]
  fileName: string
  fontSize: number
  columns: 1 | 2
  spacing: number
  lineSpacing: number
  sectionLeadIn: number
  showColumnDivider: boolean
  showSectionDivider: boolean
  headingSize: number
  fitWarning: string | null
}

export type PdfMeasure = {
  lineSpacing?: number
  sectionLeadIn?: number
  headingSize?: number
}

export type SetlistChart = {
  song: Song
  capo: number
  concert: Key
  /** The setlist entry's notes for this service, shown on the cover page. */
  notes?: string
}

export type CoverColumn = { x: number; width: number }

export type CoverRow = {
  number: string
  title: string[]
  key: string[]
  meter: string
  notes: string[]
  order: string
  /** Distance from the top of the table body to the top of this row. */
  top: number
  height: number
}

/** One page of a setlist's running order. Rows are never split across pages. */
export type CoverPage = {
  width: number
  height: number
  /** The setlist name, or its name with "(cont.)" on later pages. */
  heading: string
  date: string | null
  first: boolean
  fontSize: number
  lineHeight: number
  columns: { number: CoverColumn; title: CoverColumn; key: CoverColumn; meter: CoverColumn | null; notes: CoverColumn; order: CoverColumn | null }
  rows: CoverRow[]
}

export type SetlistSheet =
  | { kind: 'song'; layout: PdfDocument }
  | { kind: 'blank'; width: number; height: number }
  | { kind: 'cover'; pages: CoverPage[] }

export type SetlistLayout = {
  sheets: SetlistSheet[]
  pageCount: number
}

const MARGIN = 42
/** Bottom band reserved for the footer; matches the page margin so body and footer never share a line. */
const FOOTER = 42
const MONO = 0.6
/** Space above a section heading after the previous section's last line. */
export const SECTION_LEAD_IN = 12
/** Heading label + rule + gap before the first line of the section. */
export const SECTION_HEADING = 30
/** Section labels such as VERSE 1, in points. */
export const HEADING_SIZE = 11
/** How much of the natural room between lines to use. 1 adds nothing. */
export const DEFAULT_LINE_SPACING = 2.5
/** The room a line has before the next one with nothing added, per point of type. */
const LINE_ROOM = 4 / 15

export function pageSize(paper: Paper): { width: number; height: number } {
  return paper === 'letter'
    ? { width: 612, height: 792 }
    : { width: 595, height: 842 }
}

export function columnBounds(
  width: number,
  columns: 1 | 2,
): { left: number; right: number }[] {
  if (columns === 1) return [{ left: MARGIN, right: width - MARGIN }]
  const gutter = 18
  const column = (width - MARGIN * 2 - gutter) / 2
  return [
    { left: MARGIN, right: MARGIN + column },
    { left: MARGIN + column + gutter, right: width - MARGIN },
  ]
}

export function charsPerLine(
  fontSize: number,
  width: number,
  columns: 1 | 2,
): number {
  const bounds = columnBounds(width, columns)[0]
  return Math.floor((bounds.right - bounds.left) / (fontSize * MONO))
}

export function layoutStatus(layout: PdfDocument): string {
  const pages =
    layout.pages.length === 1 ? '1 page' : `${layout.pages.length} pages`
  const columns = layout.columns === 1 ? '1 column' : '2 columns'
  return `${pages} · ${layout.fontSize} pt · spacing ${layout.spacing} · ${columns}`
}

export function sectionBlockHeight(
  sectionLeadIn = SECTION_LEAD_IN,
  headingSize = HEADING_SIZE,
): number {
  return sectionLeadIn + SECTION_HEADING + (headingSize - HEADING_SIZE)
}

export function blockHeight(
  block: UntaggedBlock,
  fontSize: number,
  spacing = 1,
  measure: PdfMeasure = {},
): number {
  const sectionLeadIn = measure.sectionLeadIn ?? SECTION_LEAD_IN
  const headingSize = measure.headingSize ?? HEADING_SIZE
  let raw: number
  if (block.kind === 'section')
    raw = sectionBlockHeight(sectionLeadIn, headingSize)
  else if (block.kind === 'comment') raw = 24
  else if (block.kind === 'pointer') raw = 16
  else if (block.kind === 'bars') raw = Math.ceil(fontSize * 1.7)
  else if (block.chords.length === 0) raw = Math.ceil(fontSize * 1.35)
  else {
    raw = Math.max(fontSize * 2, Math.ceil(fontSize * 2.2))
  }
  const floor =
    block.kind === 'lyric' && block.chords.length > 0
      ? fontSize * 2
      : block.kind === 'lyric' || block.kind === 'bars'
        ? fontSize
        : block.kind === 'section'
          ? 22
          : 10
  return (
    Math.max(floor, raw * spacing) +
    lineGapBelow(block, fontSize, spacing, measure)
  )
}

/** The empty space a lyric or bar line leaves under itself, inside its height. */
export function lineGapBelow(
  block: UntaggedBlock,
  fontSize: number,
  spacing = 1,
  measure: PdfMeasure = {},
): number {
  if (block.kind !== 'lyric' && block.kind !== 'bars') return 0
  const lineSpacing = measure.lineSpacing ?? DEFAULT_LINE_SPACING
  return fontSize * LINE_ROOM * (lineSpacing - 1) * spacing
}

function readDisplay(options: PdfOptions) {
  return {
    showArtist: options.showArtist !== false,
    showKey: options.showKey !== false,
    showTime: options.showTime !== false,
    lineSpacing: options.lineSpacing ?? DEFAULT_LINE_SPACING,
    sectionLeadIn: options.sectionLeadIn ?? SECTION_LEAD_IN,
    showColumnDivider: options.showColumnDivider !== false,
    showSectionDivider: options.showSectionDivider !== false,
    headingSize: options.headingSize ?? HEADING_SIZE,
  }
}

function headerMeta(song: Song, options: PdfOptions): string {
  const display = readDisplay(options)
  return [
    display.showKey ? `Key ${formatKey(options.concert)}` : null,
    display.showTime ? song.timeSignature : null,
    display.showKey && song.tempo ? `${song.tempo} bpm` : null,
  ]
    .filter(Boolean)
    .join('    ')
}

/** Type size and line height of the chords-used strip, set in the monospaced chord face. */
export const CHORD_STRIP_SIZE = 9
export const CHORD_STRIP_LINE = 13

function shownSong(song: Song, options: PdfOptions): Song {
  const prefs = options.prefs ?? DEFAULT_PREFS
  const played = displayedSong(song, options.concert, options.capo, prefs)
  return options.easyChords ? mapSymbols(played, easyChord) : played
}

/** The chords-used strip, wrapped to the page. Empty when the option is off or the page prints no chords. */
function chordStrip(song: Song, options: PdfOptions, width: number): { label: string; invalid: boolean; index: number }[][] {
  if (!options.showChords || options.content === 'lyrics') return []
  const prefs = options.prefs ?? DEFAULT_PREFS
  const shapeKey = shiftKey(options.concert, -options.capo, prefs)
  const chords = chordSummary(shownSong(song, options), (symbol) => symbolLabel(symbol, options.numbers, shapeKey))
  const capacity = Math.floor((width - MARGIN * 2) / (CHORD_STRIP_SIZE * MONO))
  const lines: { label: string; invalid: boolean; index: number }[][] = []
  let cursor = 0
  for (const chord of chords) {
    const current = lines[lines.length - 1]
    if (!current || (cursor > 0 && cursor + chord.label.length > capacity)) {
      lines.push([{ ...chord, index: 0 }])
      cursor = chord.label.length + 2
    } else {
      current.push({ ...chord, index: cursor })
      cursor += chord.label.length + 2
    }
  }
  return lines
}

function headerReserve(song: Song, options: PdfOptions, first: boolean, width: number): number {
  // Must match drawPage() in pdf-render: title 24 + artist 16 + meta 18 + order 14 + chords used 13 a line + rule gap 16.
  if (!first) return 32
  const display = readDisplay(options)
  let reserve = 88
  if (!display.showArtist || !song.artist) reserve -= 16
  if (!headerMeta(song, options) && options.capo <= 0) reserve -= 18
  return reserve + chordStrip(song, options, width).length * CHORD_STRIP_LINE
}

function tag(blocks: UntaggedBlock[], column: PdfColumn): PdfBlock[] {
  return blocks.map((block) => ({ ...block, column }))
}

function symbolLabel(symbol: ChordSymbol, numbers: boolean, key: Key): string {
  return numbers ? nashville(symbol, key) : formatSymbol(symbol)
}

function barText(items: BarItem[], numbers: boolean, key: Key): string {
  const parts: string[] = []
  let current: string[] = []
  const flush = () => {
    if (current.length > 0) parts.push(current.join(' '))
    current = []
  }
  for (const item of items) {
    if (item.kind === 'bar') flush()
    else if (item.kind === 'rest') current.push(item.mark)
    else current.push(symbolLabel(item.symbol, numbers, key))
  }
  flush()
  return `| ${parts.join(' | ')} |`
}

type Piece = { blocks: UntaggedBlock[] }

function piecesFor(song: Song, options: PdfOptions): Piece[] {
  const prefs = options.prefs ?? DEFAULT_PREFS
  const shapeKey = shiftKey(options.concert, -options.capo, prefs)
  const played = shownSong(song, options)
  return performance(song, options.repeats).map(
    ({ section, copies, pointer }) => {
      const source =
        played.sections.find((item) => item.id === section.id) ?? section
      const blocks: UntaggedBlock[] = [
        {
          kind: 'section',
          label: source.label.toUpperCase(),
          continued: false,
        },
      ]
      if (pointer && copies > 1)
        blocks.push({
          kind: 'pointer',
          text: `Repeat ${source.label} ×${copies}`,
        })
      for (const line of source.lines) {
        if (line.type === 'comment') {
          blocks.push({ kind: 'comment', text: line.text })
          continue
        }
        if (line.type === 'bars') {
          if (options.content !== 'lyrics')
            blocks.push({
              kind: 'bars',
              text: barText(line.items, options.numbers, shapeKey),
            })
          continue
        }
        if (options.content === 'chords') {
          const labels = line.chords.map((chord) =>
            symbolLabel(chord.symbol, options.numbers, shapeKey),
          )
          blocks.push({ kind: 'bars', text: labels.join(' | ') || '—' })
          continue
        }
        if (options.content === 'lyrics') {
          blocks.push({ kind: 'lyric', text: line.text, chords: [] })
          continue
        }
        const ordered = [...line.chords]
          .map((chord) => ({
            label: symbolLabel(chord.symbol, options.numbers, shapeKey),
            index: chord.index,
            invalid: chord.symbol.kind === 'invalid',
          }))
          .sort((a, b) => a.index - b.index || a.label.localeCompare(b.label))
        const padded = padCollisions(
          line.text,
          ordered.map((chord) => ({ label: chord.label, index: chord.index })),
        )
        blocks.push({
          kind: 'lyric',
          text: padded.text,
          chords: padded.chords.map((chord, index) => ({
            ...chord,
            invalid: ordered[index]?.invalid ?? false,
          })),
        })
      }
      return { blocks }
    },
  )
}

function wrapBlock(block: UntaggedBlock, capacity: number): UntaggedBlock[] {
  if (
    (block.kind !== 'lyric' && block.kind !== 'bars') ||
    capacity < 8 ||
    block.text.length <= capacity
  )
    return [block]
  const lines: UntaggedBlock[] = []
  let text = block.text
  let chords = block.kind === 'lyric' ? block.chords : []
  let first = true
  while (text.length > 0) {
    const width = first ? capacity : Math.max(1, capacity - 2)
    let cut = text.length
    if (text.length > width) {
      const space = text.lastIndexOf(' ', width)
      cut = space > 0 ? space : width
    }
    const head = text.slice(0, cut)
    let next = cut
    while (text[next] === ' ') next += 1
    const indent = first ? 0 : 2
    const lineText = first ? head : `  ${head}`
    if (block.kind === 'bars') lines.push({ kind: 'bars', text: lineText })
    else
      lines.push({
        kind: 'lyric',
        text: lineText,
        chords: chords
          .filter((chord) => chord.index < cut)
          .map((chord) => ({ ...chord, index: chord.index + indent })),
      })
    chords = chords
      .filter((chord) => chord.index >= cut)
      .map((chord) => ({
        ...chord,
        index: Math.max(0, chord.index - next),
      }))
    if (next >= text.length) break
    text = text.slice(next)
    first = false
  }
  return lines
}

function innerHeight(height: number, reserve: number): number {
  return height - MARGIN - FOOTER - reserve
}

function layoutOnce(
  song: Song,
  options: PdfOptions,
  size: { width: number; height: number },
  fontSize: number,
  columns: 1 | 2,
  spacing: number,
): { blocks: PdfBlock[]; columnCount: 1 | 2 }[] {
  const capacity = charsPerLine(fontSize, size.width, columns)
  const pieces = piecesFor(song, options).map((piece) => ({
    blocks: piece.blocks.flatMap((block) => wrapBlock(block, capacity)),
  }))
  const display = readDisplay(options)
  const measure = (block: UntaggedBlock) =>
    blockHeight(block, fontSize, spacing, {
      lineSpacing: display.lineSpacing,
      sectionLeadIn: display.sectionLeadIn,
      headingSize: display.headingSize,
    })
  const firstInner = innerHeight(size.height, headerReserve(song, options, true, size.width))
  const nextInner = innerHeight(size.height, headerReserve(song, options, false, size.width))
  const maxInner = Math.max(firstInner, nextInner)
  const pages: { blocks: PdfBlock[]; columnCount: 1 | 2 }[] = [
    { blocks: [], columnCount: 1 },
  ]
  let columnUsed: [number, number] = [0, 0]
  let mode: 'empty' | 'full' | 'columns' = 'empty'

  const limit = () => (pages.length === 1 ? firstInner : nextInner)
  const pushPage = () => {
    pages.push({ blocks: [], columnCount: 1 })
    columnUsed = [0, 0]
    mode = 'empty'
  }
  const pieceHeight = (blocks: UntaggedBlock[]) =>
    blocks.reduce((sum, block) => sum + measure(block), 0)

  if (columns === 2) layoutTwoColumns(pieces)
  else {
    for (const piece of pieces)
      placeFullWidth(piece.blocks, pieceHeight(piece.blocks))
  }
  return pages.filter((page, index) => page.blocks.length > 0 || index === 0)

  function layoutTwoColumns(run: Piece[]) {
    let index = 0
    while (index < run.length) {
      const height = pieceHeight(run[index].blocks)
      if (height > maxInner) {
        placeFullWidth(run[index].blocks, height)
        index += 1
        continue
      }
      const columnRun: Piece[] = []
      while (index < run.length && pieceHeight(run[index].blocks) <= maxInner) {
        columnRun.push(run[index])
        index += 1
      }
      placeRun(columnRun)
    }
  }

  function placeRun(run: Piece[]) {
    let start = 0
    while (start < run.length) {
      if (pages[pages.length - 1].blocks.length > 0) pushPage()
      const room = limit()
      let end = start
      while (end < run.length) {
        if (balancedSplit(run.slice(start, end + 1), room) === null) break
        end += 1
      }
      if (end === start) {
        placeInColumns(run[start].blocks, pieceHeight(run[start].blocks))
        start += 1
        continue
      }
      const group = run.slice(start, end)
      const split = balancedSplit(group, room) ?? group.length
      for (const piece of group.slice(0, split))
        pages[pages.length - 1].blocks.push(...tag(piece.blocks, 1))
      for (const piece of group.slice(split))
        pages[pages.length - 1].blocks.push(...tag(piece.blocks, 2))
      pages[pages.length - 1].columnCount = 2
      mode = 'columns'
      start = end
    }
  }

  function balancedSplit(group: Piece[], room: number): number | null {
    const heights = group.map((piece) => pieceHeight(piece.blocks))
    if (heights.some((height) => height > room)) return null
    if (group.length === 1) return 1
    const total = heights.reduce((sum, height) => sum + height, 0)
    let best: number | null = null
    let bestDiff = Infinity
    let used = 0
    for (let index = 0; index < heights.length - 1; index += 1) {
      used += heights[index]
      const right = total - used
      const diff = Math.abs(used - right)
      if (used <= room && right <= room && diff < bestDiff) {
        bestDiff = diff
        best = index + 1
      }
    }
    return best
  }

  function placeInColumns(blocks: UntaggedBlock[], height: number) {
    if (mode === 'full') {
      if (columnUsed[0] + height <= limit()) {
        pages[pages.length - 1].blocks.push(...tag(blocks, 1))
        columnUsed[0] += height
        return
      }
      pushPage()
    }
    const room = limit()
    if (columnUsed[1] === 0 && columnUsed[0] + height <= room) {
      pages[pages.length - 1].blocks.push(...tag(blocks, 1))
      columnUsed[0] += height
      mode = 'columns'
      pages[pages.length - 1].columnCount = 2
      return
    }
    if (columnUsed[1] + height <= room) {
      pages[pages.length - 1].blocks.push(...tag(blocks, 2))
      columnUsed[1] += height
      mode = 'columns'
      pages[pages.length - 1].columnCount = 2
      return
    }
    pushPage()
    if (height <= limit()) {
      pages[pages.length - 1].blocks.push(...tag(blocks, 1))
      columnUsed[0] = height
      mode = 'columns'
      pages[pages.length - 1].columnCount = 2
      return
    }
    placeFullWidth(blocks, height)
  }

  function placeFullWidth(blocks: UntaggedBlock[], height: number) {
    if (columns === 2 && mode === 'columns') pushPage()
    if (columnUsed[0] + height <= limit() && columnUsed[1] === 0) {
      pages[pages.length - 1].blocks.push(...tag(blocks, 1))
      columnUsed[0] += height
      mode = 'full'
      return
    }
    if (height <= maxInner) {
      if (columnUsed[0] > 0 || columnUsed[1] > 0 || limit() < height) pushPage()
      pages[pages.length - 1].blocks.push(...tag(blocks, 1))
      columnUsed[0] = height
      mode = 'full'
      return
    }
    if (columnUsed[0] > 0 || columnUsed[1] > 0) pushPage()
    let slice: UntaggedBlock[] = []
    let sliceHeight = 0
    let continued = false
    const heading = blocks.find((block) => block.kind === 'section')
    const headingText =
      heading && heading.kind === 'section' ? heading.label : 'SECTION'
    for (const block of blocks) {
      const blockSize = measure(block)
      if (slice.length > 0 && sliceHeight + blockSize > limit()) {
        pages[pages.length - 1].blocks.push(...tag(slice, 1))
        pushPage()
        const marker: UntaggedBlock = {
          kind: 'section',
          label: `${headingText} (CONT.)`,
          continued: true,
        }
        slice = [marker]
        sliceHeight = measure(marker)
        continued = true
      }
      if (continued && block.kind === 'section') continue
      slice.push(block)
      sliceHeight += blockSize
    }
    pages[pages.length - 1].blocks.push(...tag(slice, 1))
    columnUsed = [sliceHeight, 0]
    mode = 'full'
  }
}

function tooWide(
  pages: { blocks: PdfBlock[] }[],
  fontSize: number,
  width: number,
  columns: 1 | 2,
): boolean {
  const capacity = charsPerLine(fontSize, width, columns)
  return pages.some((page) =>
    page.blocks.some(
      (block) => block.kind === 'lyric' && block.text.length > capacity,
    ),
  )
}

export function layoutPdf(song: Song, options: PdfOptions): PdfDocument {
  const size = pageSize(options.paper)
  let fontSize = options.fontSize
  let columns = options.columns
  let spacing = 1
  let lineSpacing = readDisplay(options).lineSpacing
  const place = () =>
    layoutOnce(song, { ...options, lineSpacing }, size, fontSize, columns, spacing)
  let pages = place()
  const wantsShrink = () =>
    options.fit === 'auto'
      ? tooWide(pages, fontSize, size.width, columns)
      : pages.length > options.fit
  while (wantsShrink()) {
    // Room between lines can't help a line that is too wide, so Auto keeps it.
    if (options.fit !== 'auto' && lineSpacing > 1)
      lineSpacing = Math.max(1, lineSpacing - 0.5)
    else if (spacing > 0.8) spacing = Math.round((spacing - 0.1) * 10) / 10
    else if (columns === 1 && options.allowTwoColumns) columns = 2
    else if (fontSize > 10) fontSize -= 1
    else break
    pages = place()
  }
  return stamp(pages, song, { ...options, lineSpacing }, size, fontSize, columns, spacing)
}

function fitWarning(fit: 1 | 2, count: number, fontSize: number): string {
  const target = fit === 1 ? '1 page' : `${fit} pages`
  const shown = count === 1 ? '1 page' : `${count} pages`
  return `Doesn't fit in ${target} at ${fontSize} pt. Showing ${shown}. Chords only, or Repeat Chorus, will shorten it.`
}

function fileName(song: Song, options: PdfOptions): string {
  const capo = options.capo > 0 ? ` - Capo ${options.capo}` : ''
  return `${song.title} - ${formatKey(options.concert)}${capo}.pdf`
}

function stamp(
  pages: { blocks: PdfBlock[]; columnCount: 1 | 2 }[],
  song: Song,
  options: PdfOptions,
  size: { width: number; height: number },
  fontSize: number,
  columns: 1 | 2,
  spacing: number,
): PdfDocument {
  const total = pages.length
  const prefs = options.prefs ?? DEFAULT_PREFS
  const keyName = formatKey(options.concert)
  const shape = formatKey(shiftKey(options.concert, -options.capo, prefs))
  const capoLabel =
    options.capo > 0
      ? `CAPO ${options.capo} · PLAY ${shape.replace(/m$/, '')} SHAPES`
      : null
  const order = song.arrangement
    .map(
      (item) =>
        song.sections.find((section) => section.id === item.sectionId)?.label ??
        '',
    )
    .filter(Boolean)
    .join(' · ')
  const display = readDisplay(options)
  const meta = headerMeta(song, options)
  const strip = chordStrip(song, options, size.width)
  return {
    fontSize,
    columns,
    spacing,
    lineSpacing: display.lineSpacing,
    sectionLeadIn: display.sectionLeadIn,
    showColumnDivider: display.showColumnDivider,
    showSectionDivider: display.showSectionDivider,
    headingSize: display.headingSize,
    fitWarning:
      options.fit === 'auto' || pages.length <= options.fit
        ? null
        : fitWarning(options.fit, pages.length, fontSize),
    fileName: fileName(song, options),
    pages: pages.map((page, index) => {
      const nextHeading = pages[index + 1]?.blocks.find(
        (block) => block.kind === 'section',
      )
      const cue =
        index === total - 1
          ? 'End of song'
          : nextHeading && nextHeading.kind === 'section'
            ? `Next page: ${titleCase(nextHeading.label)} →`
            : 'Next page →'
      const position = options.songPosition
        ? `Song ${options.songPosition.index} of ${options.songPosition.total} · `
        : ''
      return {
        width: size.width,
        height: size.height,
        blocks: page.blocks,
        columnCount: page.columnCount,
        runningHeader: index === 0 ? null : `${song.title} (cont.)`,
        title: song.title,
        artist: display.showArtist ? (song.artist ?? null) : null,
        meta,
        capoLabel,
        order: index === 0 ? `Order: ${order}` : null,
        chordsUsed: index === 0 && strip.length > 0 ? strip : null,
        footerTitle: display.showKey ? `${song.title} · Key ${keyName}` : song.title,
        cue,
        pageLabel: `${position}Page ${index + 1} of ${total}`,
      }
    }),
  }
}

function titleCase(label: string): string {
  return label.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** How wide a character of the cover's sans type is taken to be, per point. Erring wide keeps text inside its column. */
const COVER_CHAR = 0.56
const COVER_HEADING = 64
const COVER_TABLE_HEAD = 20
const COVER_ROW_PAD = 6

function wrapWords(text: string, capacity: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word
    // A single word longer than the column is broken rather than left to run over.
    while (rest.length > capacity) {
      if (line) lines.push(line)
      lines.push(rest.slice(0, capacity))
      rest = rest.slice(capacity)
      line = ''
    }
    if (!line) line = rest
    else if (line.length + 1 + rest.length <= capacity) line = `${line} ${rest}`
    else {
      lines.push(line)
      line = rest
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

/**
 * The running order of a setlist as one or more pages: number, title, key and capo, tempo and time,
 * notes, and the arrangement where it fits. The type shrinks to 10 pt before a second page is used.
 */
export function layoutCover(
  cover: { name: string; date: string },
  entries: SetlistChart[],
  options: Pick<PdfOptions, 'paper' | 'prefs'>,
): CoverPage[] {
  const size = pageSize(options.paper)
  const prefs = options.prefs ?? DEFAULT_PREFS
  const inner = size.width - MARGIN * 2
  const meterOf = (song: Song) => [song.timeSignature?.trim(), song.tempo ? `${song.tempo} bpm` : ''].filter(Boolean).join(' · ')
  const hasMeter = entries.some((entry) => meterOf(entry.song))
  const orders = entries.map((entry) => compactOrder(entry.song))

  const attempt = (fontSize: number, withOrder: boolean) => {
    const chars = (width: number) => Math.max(4, Math.floor((width - 8) / (fontSize * COVER_CHAR)))
    const number = { x: MARGIN, width: 24 }
    // The key alone needs little room; "Capo 2 · G shapes" under it needs more.
    const key = { x: 0, width: entries.some((entry) => entry.capo > 0) ? 108 : 44 }
    const meter = hasMeter ? { x: 0, width: 84 } : null
    const orderWidth = withOrder ? Math.min(150, Math.max(...orders.map((text) => text.length), 5) * fontSize * COVER_CHAR + 8) : 0
    const flexible = inner - number.width - key.width - (meter?.width ?? 0) - orderWidth
    const title = { x: number.x + number.width, width: Math.round(flexible * 0.46) }
    key.x = title.x + title.width
    if (meter) meter.x = key.x + key.width
    const notes = { x: (meter ?? key).x + (meter ?? key).width, width: flexible - title.width }
    const order = withOrder ? { x: notes.x + notes.width, width: orderWidth } : null
    const orderFits = !order || orders.every((text) => text.length <= chars(order.width))
    const lineHeight = Math.round(fontSize * 1.35)
    const rows = entries.map((entry, index) => {
      const concert = entry.concert
      const shape = formatKey(shiftKey(concert, -entry.capo, prefs)).replace(/m$/, '')
      const row = {
        number: String(index + 1),
        title: wrapWords(entry.song.title, chars(title.width)),
        key: entry.capo > 0 ? [formatKey(concert), `Capo ${entry.capo} · ${shape} shapes`] : [formatKey(concert)],
        meter: meterOf(entry.song),
        notes: entry.notes?.trim() ? wrapWords(entry.notes.trim(), chars(notes.width)) : [],
        order: withOrder ? orders[index] : '',
        top: 0,
        height: 0,
      }
      row.height = Math.max(row.title.length, row.key.length, row.notes.length, 1) * lineHeight + COVER_ROW_PAD
      return row
    })
    return { fontSize, lineHeight, columns: { number, title, key, meter, notes, order }, rows, orderFits }
  }

  const room = (first: boolean) => size.height - MARGIN - FOOTER - (first ? COVER_HEADING : 32) - COVER_TABLE_HEAD
  const fitsOnePage = (laid: ReturnType<typeof attempt>) => laid.rows.reduce((sum, row) => sum + row.height, 0) <= room(true)
  const tries = [attempt(12, true), attempt(12, false), attempt(11, false), attempt(10, false)]
  const chosen = tries.find((laid) => laid.orderFits && fitsOnePage(laid)) ?? tries[tries.length - 1]

  const pages: CoverPage[] = []
  const name = cover.name.trim() || 'Untitled setlist'
  const open = () => {
    const first = pages.length === 0
    pages.push({
      width: size.width,
      height: size.height,
      heading: first ? name : `${name} (cont.)`,
      date: first && cover.date ? cover.date : null,
      first,
      fontSize: chosen.fontSize,
      lineHeight: chosen.lineHeight,
      columns: chosen.columns,
      rows: [],
    })
  }
  open()
  let used = 0
  for (const row of chosen.rows) {
    const page = pages[pages.length - 1]
    if (page.rows.length > 0 && used + row.height > room(page.first)) {
      open()
      used = 0
    }
    pages[pages.length - 1].rows.push({ ...row, top: used })
    used += row.height
  }
  return pages
}

export function layoutSetlist(
  entries: SetlistChart[],
  options: Omit<PdfOptions, 'capo' | 'concert' | 'songPosition'>,
  rightHand: boolean,
  cover?: { name: string; date: string },
): SetlistLayout {
  const layouts = entries.map((entry, index) =>
    layoutPdf(entry.song, {
      ...options,
      capo: entry.capo,
      concert: entry.concert,
      songPosition: { index: index + 1, total: entries.length },
    }),
  )
  const sheets: SetlistSheet[] = []
  if (cover && entries.length > 0) sheets.push({ kind: 'cover', pages: layoutCover(cover, entries, options) })
  layouts.forEach((layout, index) => {
    sheets.push({ kind: 'song', layout })
    const last = index === layouts.length - 1
    if (rightHand && !last && layout.pages.length % 2 === 1) {
      const page = layout.pages[0]
      const size = pageSize(options.paper)
      sheets.push({
        kind: 'blank',
        width: page?.width ?? size.width,
        height: page?.height ?? size.height,
      })
    }
  })
  const pageCount = sheets.reduce(
    (sum, sheet) =>
      sum + (sheet.kind === 'blank' ? 1 : sheet.kind === 'cover' ? sheet.pages.length : sheet.layout.pages.length),
    0,
  )
  return { sheets, pageCount }
}
