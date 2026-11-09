import { formatKey, formatSymbol, nashville, shiftKey, type ChordSymbol, type Key } from './chord'
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
  repeats: 'full' | 'pointer'
  allowTwoColumns: boolean
  songPosition?: { index: number; total: number }
}

export type PdfChord = { label: string; index: number; invalid: boolean }

export type PdfBlock =
  | { kind: 'section'; label: string; continued: boolean }
  | { kind: 'lyric'; text: string; chords: PdfChord[] }
  | { kind: 'bars'; text: string }
  | { kind: 'comment'; text: string }
  | { kind: 'pointer'; text: string }

export type PdfPage = {
  width: number
  height: number
  blocks: PdfBlock[]
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
}

const MARGIN = 42
const FOOTER = 40
const MONO = 0.6
/** Space above a section heading after the previous section's last line. */
export const SECTION_LEAD_IN = 12
/** Heading label + rule + gap before the first line of the section. */
export const SECTION_HEADING = 30

export function pageSize(paper: Paper): { width: number; height: number } {
  return paper === 'letter' ? { width: 612, height: 792 } : { width: 595, height: 842 }
}

export function charsPerLine(fontSize: number, width: number, columns: 1 | 2): number {
  const content = width - MARGIN * 2 - (columns === 2 ? 18 : 0)
  const column = columns === 2 ? content / 2 : content
  return Math.floor(column / (fontSize * MONO))
}

export function sectionBlockHeight(): number {
  return SECTION_LEAD_IN + SECTION_HEADING
}

function blockHeight(block: PdfBlock, fontSize: number): number {
  if (block.kind === 'section') return sectionBlockHeight()
  if (block.kind === 'comment' || block.kind === 'pointer') return 16
  if (block.kind === 'bars') return Math.ceil(fontSize * 1.7)
  if (block.chords.length === 0) return Math.ceil(fontSize * 1.35)
  return Math.ceil(fontSize * 2.2)
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

type Piece = { blocks: PdfBlock[] }

function piecesFor(song: Song, options: PdfOptions): Piece[] {
  const shapeKey = shiftKey(options.concert, -options.capo)
  const played = displayedSong(song, options.concert, options.capo)
  return performance(song, options.repeats).map(({ section, copies, pointer }) => {
    const source = played.sections.find((item) => item.id === section.id) ?? section
    const blocks: PdfBlock[] = [{ kind: 'section', label: source.label.toUpperCase(), continued: false }]
    if (pointer && copies > 1) blocks.push({ kind: 'pointer', text: `Repeat ${source.label} ×${copies}` })
    for (const line of source.lines) {
      if (line.type === 'comment') {
        blocks.push({ kind: 'comment', text: line.text })
        continue
      }
      if (line.type === 'bars') {
        if (options.content !== 'lyrics') blocks.push({ kind: 'bars', text: barText(line.items, options.numbers, shapeKey) })
        continue
      }
      if (options.content === 'chords') {
        const labels = line.chords.map((chord) => symbolLabel(chord.symbol, options.numbers, shapeKey))
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
        chords: padded.chords.map((chord, index) => ({ ...chord, invalid: ordered[index]?.invalid ?? false })),
      })
    }
    return { blocks }
  })
}

function innerHeight(height: number, first: boolean): number {
  return height - MARGIN - FOOTER - (first ? 86 : 28)
}

function layoutOnce(song: Song, options: PdfOptions, size: { width: number; height: number }, fontSize: number, columns: 1 | 2, spacing: number): PdfBlock[][] {
  const pieces = piecesFor(song, options)
  const firstInner = innerHeight(size.height, true) * columns
  const nextInner = innerHeight(size.height, false) * columns
  const pages: PdfBlock[][] = [[]]
  let used = 0
  const limit = () => (pages.length === 1 ? firstInner : nextInner) * spacing
  const pushPage = () => {
    pages.push([])
    used = 0
  }
  for (const piece of pieces) {
    const height = piece.blocks.reduce((sum, block) => sum + blockHeight(block, fontSize), 0) * spacing
    const fitsAlone = height <= Math.max(firstInner, nextInner) * spacing
    if (used + height <= limit()) {
      pages[pages.length - 1].push(...piece.blocks)
      used += height
      continue
    }
    if (fitsAlone) {
      if (used > 0 || limit() < height) pushPage()
      pages[pages.length - 1].push(...piece.blocks)
      used += height
      continue
    }
    if (used > 0) pushPage()
    let slice: PdfBlock[] = []
    let sliceHeight = 0
    let continued = false
    const heading = piece.blocks.find((block) => block.kind === 'section')
    const headingText = heading && heading.kind === 'section' ? heading.label : 'SECTION'
    for (const block of piece.blocks) {
      const blockSize = blockHeight(block, fontSize) * spacing
      if (slice.length > 0 && sliceHeight + blockSize > limit()) {
        pages[pages.length - 1].push(...slice)
        pushPage()
        const marker: PdfBlock = { kind: 'section', label: `${headingText} (CONT.)`, continued: true }
        slice = [marker]
        sliceHeight = blockHeight(marker, fontSize) * spacing
        continued = true
      }
      if (continued && block.kind === 'section') continue
      slice.push(block)
      sliceHeight += blockSize
    }
    pages[pages.length - 1].push(...slice)
    used = sliceHeight
  }
  return pages.filter((blocks, index) => blocks.length > 0 || index === 0)
}

function tooWide(pages: PdfBlock[][], fontSize: number, width: number, columns: 1 | 2): boolean {
  const capacity = charsPerLine(fontSize, width, columns)
  return pages.some((blocks) => blocks.some((block) => block.kind === 'lyric' && block.text.length > capacity))
}

export function layoutPdf(song: Song, options: PdfOptions): PdfDocument {
  const size = pageSize(options.paper)
  let fontSize = options.fontSize
  let columns = options.columns
  let spacing = 1
  let pages = layoutOnce(song, options, size, fontSize, columns, spacing)
  const wantsShrink = () => (options.fit === 'auto' ? tooWide(pages, fontSize, size.width, columns) : pages.length > options.fit)
  while (wantsShrink()) {
    if (spacing > 0.8) spacing = Math.round((spacing - 0.1) * 10) / 10
    else if (columns === 1 && options.allowTwoColumns) columns = 2
    else if (fontSize > 10) fontSize -= 1
    else break
    pages = layoutOnce(song, options, size, fontSize, columns, spacing)
  }
  return stamp(pages, song, options, size, fontSize, columns)
}

function fileName(song: Song, options: PdfOptions): string {
  const capo = options.capo > 0 ? ` - Capo ${options.capo}` : ''
  return `${song.title} - ${formatKey(options.concert)}${capo}.pdf`
}

function stamp(pages: PdfBlock[][], song: Song, options: PdfOptions, size: { width: number; height: number }, fontSize: number, columns: 1 | 2): PdfDocument {
  const total = pages.length
  const keyName = formatKey(options.concert)
  const shape = formatKey(shiftKey(options.concert, -options.capo))
  const capoLabel = options.capo > 0 ? `CAPO ${options.capo} · PLAY ${shape.replace(/m$/, '')} SHAPES` : null
  const order = song.arrangement
    .map((item) => song.sections.find((section) => section.id === item.sectionId)?.label ?? '')
    .filter(Boolean)
    .join(' · ')
  const meta = [`Key ${keyName}`, song.timeSignature, song.tempo ? `${song.tempo} bpm` : null, options.numbers ? `Numbers in ${options.capo > 0 ? shape : keyName}` : null]
    .filter(Boolean)
    .join('    ')
  return {
    fontSize,
    columns,
    fileName: fileName(song, options),
    pages: pages.map((blocks, index) => {
      const nextHeading = pages[index + 1]?.find((block) => block.kind === 'section')
      const cue =
        index === total - 1
          ? 'End of song'
          : nextHeading && nextHeading.kind === 'section'
            ? `Next page: ${titleCase(nextHeading.label)} →`
            : 'Next page →'
      const position = options.songPosition ? `Song ${options.songPosition.index} of ${options.songPosition.total} · ` : ''
      return {
        width: size.width,
        height: size.height,
        blocks,
        runningHeader: index === 0 ? null : `${song.title} (cont.)`,
        title: song.title,
        artist: song.artist ?? null,
        meta,
        capoLabel,
        order: index === 0 ? `Order: ${order}` : null,
        footerTitle: `${song.title} · Key ${keyName}`,
        cue,
        pageLabel: `${position}Page ${index + 1} of ${total}`,
      }
    }),
  }
}

function titleCase(label: string): string {
  return label.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}
