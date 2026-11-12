import type { Key } from './chord'
import type { Song } from './song'

export type SetlistEntry = {
  songId: string
  viewId?: string
  key?: Key
  capo?: number
  notes?: string
}

export type Setlist = {
  id: string
  name: string
  date: string
  entries: SetlistEntry[]
}

export const ACCENTS = ['ink', 'teal', 'plum', 'clay', 'graphite'] as const
export type Accent = (typeof ACCENTS)[number]

export type Settings = {
  theme: 'system' | 'light' | 'dark'
  accent: Accent
  textSize: 's' | 'm' | 'l'
  numbers: boolean
  prefs: { gb: boolean; csharp: boolean }
  normalise: boolean
  paper: 'a4' | 'letter'
  lyricSize: number
  allowTwoColumns: boolean
}

export type LibrarySnapshot = {
  songs: Song[]
  setlists: Setlist[]
  settings: Settings
}

export const defaultSettings = (): Settings => ({
  theme: 'system',
  accent: 'ink',
  textSize: 'm',
  numbers: false,
  prefs: { gb: false, csharp: false },
  normalise: false,
  paper: 'a4',
  lyricSize: 12,
  allowTwoColumns: true,
})

export type LibraryRepository = {
  load(): Promise<LibrarySnapshot>
  saveSong(song: Song): Promise<void>
  deleteSong(id: string): Promise<void>
  saveSetlist(setlist: Setlist): Promise<void>
  deleteSetlist(id: string): Promise<void>
  saveSettings(settings: Settings): Promise<void>
}
