import { cleanPage, unwrapChMarkup } from './shared'
import type { SiteCleaner } from './types'

export const ultimateGuitarCleaner: SiteCleaner = {
  id: 'ultimate-guitar',
  detect(text) {
    if (/ultimate[- ]guitar/i.test(text)) return true
    if (/\[ch\].*?\[\/ch\]/i.test(text) || /\[tab\]/i.test(text)) return true
    const chromeHits = ['capo:', 'tuning:', 'transpose', 'difficulty', 'contributor'].filter((token) => new RegExp(token, 'i').test(text)).length
    return chromeHits >= 3 && /verse|chorus/i.test(text)
  },
  clean(text) {
    return cleanPage(unwrapChMarkup(text))
  },
}
