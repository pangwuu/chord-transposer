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

/** The shared part of a library. Per-device settings live in `SettingsStore`. */
export type LibrarySnapshot = {
  songs: Song[]
  setlists: Setlist[]
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
  /**
   * Delivers the whole library now, and again after every change to it, whoever made the change.
   * A snapshot always includes this device's own writes made so far.
   * `onError` is called if the library cannot be read. Returns the unsubscribe.
   */
  subscribe(onChange: (snapshot: LibrarySnapshot) => void, onError?: (error: unknown) => void): () => void
  saveSong(song: Song): Promise<void>
  /** Also removes the song from every setlist. */
  deleteSong(id: string): Promise<void>
  saveSetlist(setlist: Setlist): Promise<void>
  deleteSetlist(id: string): Promise<void>
}
