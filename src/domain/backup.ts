import type { Settings, Setlist } from './library-types'
import type { Song } from './song'

export type BackupFile = {
  version: 1
  songs: Song[]
  setlists: Setlist[]
  settings: Settings
}

export function planRestore(current: Song[], incoming: Song[]): { conflicts: string[]; fresh: Song[] } {
  const ids = new Set(current.map((song) => song.id))
  return {
    conflicts: incoming.filter((song) => ids.has(song.id)).map((song) => song.id),
    fresh: incoming.filter((song) => !ids.has(song.id)),
  }
}

export function applyRestore(current: Song[], incoming: Song[], choices: Record<string, 'replace' | 'keep'>): Song[] {
  const next = [...current]
  for (const song of incoming) {
    const index = next.findIndex((item) => item.id === song.id)
    if (index < 0) {
      next.push(song)
      continue
    }
    if (choices[song.id] === 'replace') next[index] = song
    if (choices[song.id] === 'keep') next.push({ ...song, id: `${song.id}-copy` })
  }
  return next
}
