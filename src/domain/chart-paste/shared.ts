import { parseKey } from '../chord'
import { classifyLine, isTabLine, type LineKind } from './line-kind'
import type { ChartPasteMeta, CleanResult } from './types'

/** Words a site puts on a line by themselves. Whole lines only, so a lyric like "Search me, O God" survives. */
const CHROME_LINES = new Set(
  `sign in|sign up|sign up free|sign up premium|log in|login/register|search|search songs|advanced search|cookie settings|related|related songs|sponsored|sponsored links|shop|comments|comment|leave a comment|send|reply|transpose|difficulty|ratings|versions|version|more versions|official|open official|create account|download|download pdf|pdf|download the app|print|report|report problem|report bad tab|ad|ads|advertising|publicidade|ultimate guitar|ultimate|guitar|com|chordie|chordie.com|e-chords|echords|free guitar chords|guitar chords & tabs|guitar chords|tabs|courses|songbooks|articles|forums|forum|publish tab|pro+|en|install|save|edit|share|share page|tweet|autoscroll|auto scroll|simplify|simplify chords|view in app|strumming|chords|ukulele|piano|play|listen|x|add to favorites|add to songbook|show all|home|home page|songs|artists|public books|my songbook|resources|view|font|scroll|more|youtube videos|show chords|hide tabs|drawings|columns|settings|tuning|capo|correct song|backing track|check out the tab|easy|beginner|intermediate|advanced|expert|discover more|learn music theory|stream hymns|find song lyrics|please rate this tab|accept allreject allcustomize`.split(
    '|',
  ),
)

const CHROME_PATTERNS = [
  /^[+\-±]\d+$/,
  /^\d+(\.\d+)?\s*\/\s*5/,
  /^[\d.,]+k?\s+(ratings?|comments?)\b/i,
  /^[\d,]+\s+views/i,
  /^(difficulty|contributors?|author|rating|last edit|speed|sent by)\b\s*:/i,
  /^(login - add to songbook|official version created by|important: the song above|suggested pattern|show all \(|there is no strumming pattern|by helping ug|create correction)/i,
  /\buses cookies\b/i,
]

const CHART_MARKUP = /\{start_of_|\{(?:title|t|key|k|soc|sov)\b|\[[A-G][^\]]*\]\S/

export function isChromeLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  return CHROME_LINES.has(trimmed.toLowerCase()) || CHROME_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function isMetaLine(line: string): boolean {
  return /^(key|capo|tuning)\s*:/i.test(line.trim())
}

function looksLikeChordPair(lines: string[], kinds: LineKind[], index: number): boolean {
  const kind = kinds[index]
  if (kind.kind !== 'chords') return false
  const lyricAt = (at: number) => kinds[at]?.kind === 'lyric' && !isChromeLine(lines[at]) && (lines[at].trim().length >= 3 || /^[a-z]/.test(lines[at].trim()))
  if (kind.chords >= 2) return lyricAt(index + 1) || (kinds[index + 1]?.kind === 'blank' && lyricAt(index + 2))
  const after = kinds[index - 1]
  if (after?.kind === 'chords' && after.chords === 1) return false
  return lyricAt(index + 1)
}

/** Lines that mark the chart for certain. A row of chords alone may be a site's list of the chords used. */
function isStrongAnchor(lines: string[], kinds: LineKind[], index: number): boolean {
  if (isChromeLine(lines[index])) return false
  return kinds[index].kind === 'heading' || CHART_MARKUP.test(lines[index]) || looksLikeChordPair(lines, kinds, index)
}

function isChordRow(lines: string[], kinds: LineKind[], index: number): boolean {
  const kind = kinds[index]
  return kind?.kind === 'chords' && kind.chords >= 2 && !isChromeLine(lines[index])
}

function chartBounds(lines: string[], kinds: LineKind[]): { start: number; end: number } | null {
  const strong = lines.flatMap((_, index) => (isStrongAnchor(lines, kinds, index) ? [index] : []))
  if (strong.length === 0) {
    const rows = lines.flatMap((_, index) => (isChordRow(lines, kinds, index) ? [index] : []))
    return rows.length ? { start: rows[0], end: rows[rows.length - 1] } : null
  }
  let start = strong[0]
  let end = strong[strong.length - 1]
  while (end + 1 < lines.length && kinds[end + 1].kind === 'lyric' && !isChromeLine(lines[end + 1])) end += 1
  // A chord row touching the chart belongs to it: an intro or a closing line with no heading.
  for (;;) {
    const before = kinds[start - 1]?.kind === 'blank' ? start - 2 : start - 1
    if (!isChordRow(lines, kinds, before)) break
    start = before
  }
  for (;;) {
    const after = kinds[end + 1]?.kind === 'blank' ? end + 2 : end + 1
    if (!isChordRow(lines, kinds, after)) break
    end = after
  }
  return { start, end }
}

/** Sites can drop an advert between two rows of a chart. Other chrome words are left alone here: they may be lyrics. */
const ADVERT = /^(ads?|advertising|publicidade|sponsored(\s+links)?)$/i

/** The part of a page that is the chart. */
export function trimChartRegion(lines: string[]): string[] {
  const bounds = chartBounds(lines, lines.map(classifyLine))
  if (!bounds) return []
  return lines.slice(bounds.start, bounds.end + 1).filter((line) => !ADVERT.test(line.trim()) && !isMetaLine(line))
}

function headerOf(lines: string[]): string[] {
  const bounds = chartBounds(lines, lines.map(classifyLine))
  return bounds ? lines.slice(0, bounds.start) : lines
}

function isTitleCandidate(line: string): boolean {
  if (!line || line.length > 80 || isChromeLine(line) || isMetaLine(line) || isTabLine(line)) return false
  const kind = classifyLine(line).kind
  return kind === 'lyric' && !/^by\s+/i.test(line)
}

export function extractMeta(lines: string[]): ChartPasteMeta {
  const meta: ChartPasteMeta = {}
  const header = headerOf(lines)
  const text = header.join('\n')

  const key = text.match(/(?<![a-z])[Kk]ey\s*:\s*([A-G][#b]?m?)(?![a-ln-z#])/)
  if (key) {
    try {
      meta.key = parseKey(key[1])
    } catch {
      /* not a key we can read */
    }
  }
  const capo = text.match(/(?<![a-z])[Cc]apo\s*:?[ \t]*(\d+)/)
  if (capo) meta.capo = Number(capo[1])
  const tuning = text.match(/\btuning\s*:\s*(.+?)(?=key\s*:|capo\s*:|$)/im)
  if (tuning) meta.tuning = tuning[1].trim()

  const trimmed = header.map((line) => line.trim())
  for (const line of trimmed) {
    const listing = line.match(/^(.+?)\s+(?:guitar\s+)?(?:chords?|tabs?|ukulele(?:\s+chords)?)(?:\s*\(ver\s*\d+\))?\s+by\s+(.+)$/i)
    if (listing) {
      meta.title = listing[1]
      meta.artist = listing[2]
      return meta
    }
  }

  // E-Chords sets the title and artist straight above its instrument label.
  const label = trimmed.findIndex((line) => /^guitar chords$/i.test(line))
  if (label >= 2 && isTitleCandidate(trimmed[label - 2]) && isTitleCandidate(trimmed[label - 1])) {
    meta.title = trimmed[label - 2]
    meta.artist = trimmed[label - 1]
    return meta
  }

  for (const line of trimmed) {
    const by = line.match(/^by\s+(.+)$/i)
    if (by) {
      meta.artist = by[1].trim()
      break
    }
  }
  meta.title = trimmed.find(isTitleCandidate)
  return meta
}

export function looksLikeAsciiTab(text: string): boolean {
  const lines = text.split('\n')
  const kinds = lines.map(classifyLine)
  const tabLines = kinds.filter((kind) => kind.kind === 'tab').length
  return tabLines >= 4 && !lines.some((_, index) => looksLikeChordPair(lines, kinds, index))
}

/** Lyric-looking line after the title, used by sites that print the artist without "by". */
function artistAfterTitle(lines: string[], meta: ChartPasteMeta): void {
  if (meta.artist || !meta.title) return
  const titleIndex = lines.findIndex((line) => line.trim() === meta.title)
  if (titleIndex < 0) return
  for (let index = titleIndex + 1; index < Math.min(lines.length, titleIndex + 4); index += 1) {
    const candidate = lines[index].trim()
    if (!isTitleCandidate(candidate)) continue
    const paired = candidate.match(/^(.+?)\s+-\s+(.+)$/)
    if (paired) {
      meta.artist = paired[1]
      meta.title = paired[2]
    } else {
      meta.artist = candidate
    }
    return
  }
}

export function cleanPage(text: string, options: { artistAfterTitle?: boolean } = {}): CleanResult {
  const lines = text.split('\n')
  const meta = extractMeta(lines)
  if (options.artistAfterTitle) artistAfterTitle(headerOf(lines), meta)
  if (looksLikeAsciiTab(text)) return { body: '', meta, notices: ['Looks like a tab; paste the Chords version'] }
  const chart = trimChartRegion(lines)
  const body = chart.length ? `${chart.join('\n').trimEnd()}\n` : ''
  return { body, meta, notices: [] }
}

export function unwrapChMarkup(text: string): string {
  return text.replace(/\[ch\](.*?)\[\/ch\]/gi, '$1').replace(/\[\/?tab\]/gi, '')
}
