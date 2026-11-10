import {
  DEFAULT_PREFS,
  formatKey,
  formatSymbol,
  nashville,
  shiftKey,
  type ChordSymbol,
  type Key,
  type SpellingPrefs,
} from './chord'
import { padCollisions } from './line-layout'
import { displayedSong, performance, type BarItem, type Song } from './song'

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
  chordLyricSpacing?: number
  sectionLeadIn?: number
  showColumnDivider?: boolean
  showSectionDivider?: boolean
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
  chordLyricSpacing: number
  sectionLeadIn: number
  showColumnDivider: boolean
  showSectionDivider: boolean
  fitWarning: string | null
}

export type PdfMeasure = {
  chordLyricSpacing?: number
  sectionLeadIn?: number
}

export type SetlistChart = {
  song: Song
  capo: number
  concert: Key
}

export type SetlistSheet =
  | { kind: 'song'; layout: PdfDocument }
  | { kind: 'blank'; width: number; height: number }

export type SetlistLayout = {
  sheets: SetlistSheet[]
  pageCount: number
}

const MARGIN = 42
const FOOTER = 40
const MONO = 0.6
/** Space above a section heading after the previous section's last line. */
export const SECTION_LEAD_IN = 12
/** Heading label + rule + gap before the first line of the section. */
export const SECTION_HEADING = 30

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

export function sectionBlockHeight(sectionLeadIn = SECTION_LEAD_IN): number {
  return sectionLeadIn + SECTION_HEADING
}

export function blockHeight(
  block: UntaggedBlock,
  fontSize: number,
  spacing = 1,
  measure: PdfMeasure = {},
): number {
  const chordLyricSpacing = measure.chordLyricSpacing ?? 1
  const sectionLeadIn = measure.sectionLeadIn ?? SECTION_LEAD_IN
  let raw: number
  if (block.kind === 'section') raw = sectionBlockHeight(sectionLeadIn)
  else if (block.kind === 'comment' || block.kind === 'pointer') raw = 16
  else if (block.kind === 'bars') raw = Math.ceil(fontSize * 1.7)
  else if (block.chords.length === 0) raw = Math.ceil(fontSize * 1.35)
  else {
    const line = fontSize * 2
    const base = Math.max(line, Math.ceil(fontSize * 2.2))
    raw = line + (base - line) * chordLyricSpacing
  }
  const floor =
    block.kind === 'lyric' && block.chords.length > 0
      ? fontSize * 2
      : block.kind === 'lyric' || block.kind === 'bars'
        ? fontSize
        : block.kind === 'section'
          ? 22
          : 10
  return Math.max(floor, raw * spacing)
}

function readDisplay(options: PdfOptions) {
  return {
    showArtist: options.showArtist !== false,
    showKey: options.showKey !== false,
    showTime: options.showTime !== false,
    chordLyricSpacing: options.chordLyricSpacing ?? 1,
    sectionLeadIn: options.sectionLeadIn ?? SECTION_LEAD_IN,
    showColumnDivider: options.showColumnDivider !== false,
    showSectionDivider: options.showSectionDivider !== false,
  }
}

function headerMeta(song: Song, options: PdfOptions): string {
  const display = readDisplay(options)
  const prefs = options.prefs ?? DEFAULT_PREFS
  const keyName = formatKey(options.concert)
  const shape = formatKey(shiftKey(options.concert, -options.capo, prefs))
  return [
    display.showKey ? `Key ${keyName}` : null,
    display.showTime ? song.timeSignature : null,
    display.showKey && song.tempo ? `${song.tempo} bpm` : null,
    display.showKey && options.numbers
      ? `Numbers in ${options.capo > 0 ? shape : keyName}`
      : null,
  ]
    .filter(Boolean)
    .join('    ')
}

function headerReserve(song: Song, options: PdfOptions, first: boolean): number {
  if (!first) return 28
  const display = readDisplay(options)
  let reserve = 86
  if (!display.showArtist && song.artist) reserve -= 16
  if (!headerMeta(song, options) && options.capo <= 0) reserve -= 18
  return reserve
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
  const played = displayedSong(song, options.concert, options.capo, prefs)
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
      chordLyricSpacing: display.chordLyricSpacing,
      sectionLeadIn: display.sectionLeadIn,
    })
  const firstInner = innerHeight(size.height, headerReserve(song, options, true))
  const nextInner = innerHeight(size.height, headerReserve(song, options, false))
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
  let pages = layoutOnce(song, options, size, fontSize, columns, spacing)
  const wantsShrink = () =>
    options.fit === 'auto'
      ? tooWide(pages, fontSize, size.width, columns)
      : pages.length > options.fit
  while (wantsShrink()) {
    if (spacing > 0.8) spacing = Math.round((spacing - 0.1) * 10) / 10
    else if (columns === 1 && options.allowTwoColumns) columns = 2
    else if (fontSize > 10) fontSize -= 1
    else break
    pages = layoutOnce(song, options, size, fontSize, columns, spacing)
  }
  return stamp(pages, song, options, size, fontSize, columns, spacing)
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
  return {
    fontSize,
    columns,
    spacing,
    chordLyricSpacing: display.chordLyricSpacing,
    sectionLeadIn: display.sectionLeadIn,
    showColumnDivider: display.showColumnDivider,
    showSectionDivider: display.showSectionDivider,
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

export function layoutSetlist(
  entries: SetlistChart[],
  options: Omit<PdfOptions, 'capo' | 'concert' | 'songPosition'>,
  rightHand: boolean,
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
      sum + (sheet.kind === 'blank' ? 1 : sheet.layout.pages.length),
    0,
  )
  return { sheets, pageCount }
}
