import { formatKey, formatSymbol, parseChord, parseKey } from './chord'
import {
  type BarItem,
  type BarLine,
  type IdGen,
  type LyricLine,
  type Section,
  type SectionKind,
  type Song,
  createId,
  emptySong,
  inferKind,
} from './song'

function kindFromDirective(name: string, label: string): SectionKind {
  if (name === 'chorus') return 'chorus'
  if (name === 'bridge') return 'bridge'
  if (name === 'tab' || name === 'grid') return inferKind(label)
  if (name === 'verse') return inferKind(label)
  return inferKind(label || name)
}

function defaultLabel(name: string): string {
  if (name === 'chorus') return 'Chorus'
  if (name === 'bridge') return 'Bridge'
  if (name === 'tab' || name === 'grid') return 'Instrumental'
  return 'Verse'
}

function parseBracketLine(line: string, ids: IdGen): LyricLine {
  let text = ''
  const chords: LyricLine['chords'] = []
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== '[') {
      text += line[index]
      continue
    }
    const end = line.indexOf(']', index)
    if (end < 0) {
      text += line.slice(index)
      break
    }
    chords.push({ id: ids(), index: text.length, symbol: parseChord(line.slice(index + 1, end)) })
    index = end
  }
  return { id: ids(), type: 'lyric', text, chords, needsCheck: false }
}

function barsForChordOnly(line: LyricLine, ids: IdGen): LyricLine | BarLine {
  if (line.chords.length === 0 || /[A-Za-z0-9]/.test(line.text)) return line
  const names = [...line.chords].sort((a, b) => a.index - b.index).map((chord) => formatSymbol(chord.symbol))
  return parseBarLine(`| ${names.join(' | ')} |`, ids)
}

function isBarLine(line: string): boolean {
  if (!line.includes('|')) return false
  const tokens = line.split(/[\s|]+/).filter(Boolean)
  return tokens.length > 0 && tokens.every((token) => token === '-' || token === '/' || token === 'x' || parseChord(token).kind !== 'invalid')
}

function parseBarLine(raw: string, ids: IdGen): BarLine {
  const items: BarItem[] = []
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

export function formatLyric(line: LyricLine): string {
  const chars = [...line.text]
  const chords = [...line.chords].sort((a, b) => b.index - a.index || b.id.localeCompare(a.id))
  for (const chord of chords) chars.splice(Math.max(0, Math.min(chars.length, chord.index)), 0, `[${formatSymbol(chord.symbol)}]`)
  return chars.join('')
}

export function formatBarLine(line: BarLine): string {
  const parts: string[] = []
  let current: string[] = []
  const flush = () => {
    if (current.length > 0) parts.push(current.join(' '))
    current = []
  }
  for (const item of line.items) {
    if (item.kind === 'bar') flush()
    else if (item.kind === 'rest') current.push(item.mark)
    else current.push(formatSymbol(item.symbol))
  }
  flush()
  return `| ${parts.join(' | ')} |`
}

export function fromChordPro(text: string, ids: IdGen = createId): Song {
  const song = emptySong({ sections: [], arrangement: [] }, ids)
  song.sections = []
  song.arrangement = []
  let section: Section | null = null
  const ensure = () => {
    if (!section) {
      section = { id: ids(), kind: 'verse', label: 'Verse 1', lines: [] }
      song.sections.push(section)
      song.arrangement.push({ sectionId: section.id })
    }
    return section
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const directive = line.match(/^\{([^:}]+)(?::\s*(.*))?\}$/)
    if (directive) {
      const name = directive[1].trim().toLowerCase()
      const value = (directive[2] ?? '').trim()
      if (name === 'title' || name === 't') song.title = value
      else if (name === 'artist' || name === 'subtitle' || name === 'st') song.artist = value
      else if (name === 'composer') song.writers = value
      else if (name === 'key' || name === 'k') song.originalKey = parseKey(value)
      else if (name === 'tempo') song.tempo = Number(value)
      else if (name === 'time' || name === 'time_signature') song.timeSignature = value
      else if (name === 'ccli') song.ccli = value
      else if (name.startsWith('start_of_')) {
        const kindName = name.slice('start_of_'.length)
        const label = value || defaultLabel(kindName)
        section = { id: ids(), kind: kindFromDirective(kindName, label), label, lines: [] }
        song.sections.push(section)
        song.arrangement.push({ sectionId: section.id })
      } else if (name.startsWith('end_of_') || name === 'eov' || name === 'eoc') section = null
      else if (name === 'soc') {
        section = { id: ids(), kind: 'chorus', label: 'Chorus', lines: [] }
        song.sections.push(section)
        song.arrangement.push({ sectionId: section.id })
      } else if (name === 'sov') {
        section = { id: ids(), kind: 'verse', label: 'Verse', lines: [] }
        song.sections.push(section)
        song.arrangement.push({ sectionId: section.id })
      } else if (name === 'comment' || name === 'c' || name === 'comment_italic') {
        ensure().lines.push({ id: ids(), type: 'comment', text: value })
      }
      continue
    }
    ensure().lines.push(isBarLine(line) ? parseBarLine(line, ids) : barsForChordOnly(parseBracketLine(line, ids), ids))
  }
  if (song.sections.length === 0) return emptySong({ title: song.title, originalKey: song.originalKey, artist: song.artist }, ids)
  return song
}

export function toChordPro(song: Song): string {
  const lines = [`{title: ${song.title}}`]
  if (song.artist) lines.push(`{artist: ${song.artist}}`)
  if (song.writers) lines.push(`{composer: ${song.writers}}`)
  lines.push(`{key: ${formatKey(song.originalKey)}}`)
  if (song.tempo) lines.push(`{tempo: ${song.tempo}}`)
  if (song.timeSignature) lines.push(`{time: ${song.timeSignature}}`)
  if (song.ccli) lines.push(`{ccli: ${song.ccli}}`)
  for (const section of song.sections) {
    lines.push(`{start_of_${section.kind}: ${section.label}}`)
    for (const line of section.lines) {
      if (line.type === 'comment') lines.push(`{comment: ${line.text}}`)
      else if (line.type === 'bars') lines.push(formatBarLine(line))
      else lines.push(formatLyric(line))
    }
    lines.push(`{end_of_${section.kind}}`)
  }
  return lines.join('\n')
}
