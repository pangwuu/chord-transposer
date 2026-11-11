import { cleanPage } from './shared'
import type { SiteCleaner } from './types'

export const chordieCleaner: SiteCleaner = {
  id: 'chordie',
  detect(text) {
    return /chordie\.com/i.test(text) || /\bChordie\b/.test(text)
  },
  clean(text) {
    return cleanPage(text, { artistAfterTitle: true })
  },
}
