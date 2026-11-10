import type { Key } from '../chord'

export type ChartPasteSource = 'ultimate-guitar' | 'chordie' | 'e-chords'

export type ChartPasteMeta = {
  title?: string
  artist?: string
  key?: Key
  capo?: number
  tuning?: string
}

export type CleanResult = {
  body: string
  meta: ChartPasteMeta
  notices: string[]
}

export type SiteCleaner = {
  id: ChartPasteSource
  detect(raw: string): boolean
  clean(raw: string): CleanResult
}
