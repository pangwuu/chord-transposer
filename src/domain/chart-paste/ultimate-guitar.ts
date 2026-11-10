import { extractMeta, isChromeLine, looksLikeAsciiTab, trimChartRegion, unwrapChMarkup } from './shared'
import type { SiteCleaner } from './types'

export const ultimateGuitarCleaner: SiteCleaner = {
  id: 'ultimate-guitar',
  detect(raw) {
    if (/ultimate[- ]guitar/i.test(raw)) return true
    if (/\[ch\].*?\[\/ch\]/i.test(raw) || /\[tab\]/i.test(raw)) return true
    const chromeHits = ['capo:', 'tuning:', 'transpose', 'difficulty', 'contributor'].filter((token) =>
      new RegExp(token, 'i').test(raw),
    ).length
    return chromeHits >= 3 && /verse|chorus|\[ch\]/i.test(raw)
  },
  clean(raw) {
    const notices: string[] = []
    const unwrapped = unwrapChMarkup(raw)
    const lines = unwrapped.split(/\r?\n/)
    const meta = extractMeta(lines)

    if (looksLikeAsciiTab(unwrapped)) {
      notices.push('Looks like a tab; paste the Chords version')
      return { body: '', meta, notices }
    }

    const chart = trimChartRegion(lines).filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      if (isChromeLine(trimmed)) return false
      if (/^(key|capo|tuning)\s*:/i.test(trimmed)) return false
      if (/^by\s+/i.test(trimmed) && meta.artist && trimmed.toLowerCase().includes(meta.artist.toLowerCase())) return false
      if (meta.title && trimmed === meta.title) return false
      return true
    })

    // Drop leading blank lines
    while (chart.length && !chart[0].trim()) chart.shift()

    return {
      body: chart.join('\n').trimEnd() + '\n',
      meta,
      notices,
    }
  },
}
