import { cleanPage } from './shared'
import type { SiteCleaner } from './types'

export const eChordsCleaner: SiteCleaner = {
  id: 'e-chords',
  detect(text) {
    return /e-?chords\.com/i.test(text) || /\bE-Chords\b/i.test(text) || /\beChords\b/i.test(text)
  },
  clean(text) {
    return cleanPage(text, { artistAfterTitle: true })
  },
}
