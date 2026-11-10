import { parseChord, parseKey } from '../chord'
import type { ChartPasteMeta } from './types'

const HEADING =
  /^(intro|verse|chorus|bridge|tag|pre-?chorus|instrumental|interlude|outro|ending)\b/i

const CHROME =
  /^(sign in|log in|search(\s+songs)?|cookie|related(\s+songs)?|sponsored(\s+links)?|shop|comments?|leave a comment|transpose|difficulty|contributor|ratings?|versions?|official|create account|download(\s+the\s+app)?|print|report|ads?|ultimate guitar|chordie(\.com)?|e-?chords|free guitar chords|guitar chords\s*&\s*tabs)\b/i

export function isHeading(line: string): boolean {
  const trimmed = line.trim()
  return Boolean(trimmed) && trimmed.length <= 48 && HEADING.test(trimmed)
}

export function isChordish(line: string): boolean {
  const tokens = line
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token !== '|')
  if (tokens.length === 0) return false
  return tokens.every((token) => {
    if (token === '-' || token === '/' || token === 'x') return true
    return parseChord(token).kind !== 'invalid' || /^[A-GH](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M)?\d*$/i.test(token)
  })
}

export function isChromeLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/^[+\-±]\d+$/.test(trimmed)) return true
  if (/^\d+(\.\d+)?\s*\/\s*5/.test(trimmed)) return true
  if (/^\d+\s+ratings?\b/i.test(trimmed)) return true
  if (/^by\s+/i.test(trimmed)) return false
  return CHROME.test(trimmed)
}

export function looksLikeAsciiTab(text: string): boolean {
  const lines = text.split(/\r?\n/)
  let tabLines = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^[eEbBaAdDgG]\|[-0-9xhpbr/\\|]+/.test(trimmed)) tabLines += 1
    else if (/^\|?[-0-9x]{3,}/.test(trimmed) && trimmed.includes('-')) tabLines += 1
  }
  return tabLines >= 4
}

export function trimChartRegion(lines: string[]): string[] {
  let start = -1
  let end = -1
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line || isChromeLine(line)) continue
    if (isHeading(line) || isChordish(line) || line.includes('[ch]') || /\{start_of_/i.test(line) || /\[[A-Ga-g]/.test(line)) {
      if (start < 0) start = index
      end = index
    } else if (start >= 0 && !isMetaLine(line)) {
      end = index
    }
  }
  if (start < 0) return []
  return lines.slice(start, end + 1).filter((line) => !isChromeLine(line.trim()))
}

export function isMetaLine(line: string): boolean {
  return /^(key|capo|tuning)\s*:/i.test(line.trim())
}

export function extractMeta(lines: string[]): ChartPasteMeta {
  const meta: ChartPasteMeta = {}
  let chartStart = lines.length
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line || isChromeLine(line) || isMetaLine(line)) continue
    if (isHeading(line) || isChordish(line) || line.includes('[ch]') || /\{start_of_/i.test(line) || /^\[[A-Ga-g]/.test(line) || /^\[(?:verse|chorus|bridge|intro|outro|tag|instrumental)/i.test(line)) {
      chartStart = index
      break
    }
  }
  const header = lines.slice(0, chartStart)

  for (const raw of header) {
    const line = raw.trim()
    const key = line.match(/^key\s*:\s*(.+)$/i)
    if (key) {
      try {
        meta.key = parseKey(key[1].trim())
      } catch {
        /* ignore */
      }
      continue
    }
    const capo = line.match(/^capo\s*:\s*(\d+)\b/i)
    if (capo) {
      meta.capo = Number(capo[1])
      continue
    }
    const tuning = line.match(/^tuning\s*:\s*(.+)$/i)
    if (tuning) {
      meta.tuning = tuning[1].trim()
      continue
    }
    const by = line.match(/^by\s+(.+)$/i)
    if (by && !meta.artist) {
      meta.artist = by[1].trim()
      continue
    }
  }

  if (!meta.title) {
    for (const raw of header) {
      const line = raw.trim()
      if (!line || isChromeLine(line) || isMetaLine(line) || isHeading(line) || isChordish(line)) continue
      if (/^by\s+/i.test(line)) continue
      if (line.length > 80) continue
      meta.title = line
      break
    }
  }

  return meta
}

export function unwrapChMarkup(text: string): string {
  return text
    .replace(/\[ch\](.*?)\[\/ch\]/gi, '$1')
    .replace(/\[\/?tab\]/gi, '')
    .replace(/\[(intro|verse[^\]]*|chorus[^\]]*|bridge[^\]]*|tag[^\]]*|pre-?chorus[^\]]*|instrumental[^\]]*|interlude[^\]]*|outro[^\]]*|ending[^\]]*)\]/gi, '$1')
}
