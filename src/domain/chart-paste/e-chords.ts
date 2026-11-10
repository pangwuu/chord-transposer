import { extractMeta, isChromeLine, trimChartRegion } from './shared'
import type { SiteCleaner } from './types'

export const eChordsCleaner: SiteCleaner = {
  id: 'e-chords',
  detect(raw) {
    return /e-?chords\.com/i.test(raw) || /\bE-Chords\b/i.test(raw) || /\beChords\b/i.test(raw)
  },
  clean(raw) {
    const lines = raw.split(/\r?\n/)
    const meta = extractMeta(lines)

    if (!meta.artist && meta.title) {
      const titleIndex = lines.findIndex((line) => line.trim() === meta.title)
      if (titleIndex >= 0) {
        for (let index = titleIndex + 1; index < Math.min(lines.length, titleIndex + 4); index += 1) {
          const candidate = lines[index].trim()
          if (!candidate || isChromeLine(candidate) || /^(key|capo|tuning)\s*:/i.test(candidate)) continue
          if (isHeadingLike(candidate) || candidate.includes('|')) break
          meta.artist = candidate
          break
        }
      }
    }

    const chart = trimChartRegion(lines).filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      if (isChromeLine(trimmed)) return false
      if (/^(key|capo|tuning)\s*:/i.test(trimmed)) return false
      if (meta.title && trimmed === meta.title) return false
      if (meta.artist && trimmed === meta.artist) return false
      return true
    })

    while (chart.length && !chart[0].trim()) chart.shift()

    return {
      body: chart.join('\n').trimEnd() + '\n',
      meta,
      notices: [],
    }
  },
}

function isHeadingLike(line: string): boolean {
  return /^(intro|verse|chorus|bridge|tag|pre-?chorus|instrumental|interlude|outro|ending)\b/i.test(line)
}
