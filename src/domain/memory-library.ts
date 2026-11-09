import { defaultSettings, type LibraryRepository, type LibrarySnapshot, type Setlist, type Settings } from './library-types'
import type { Song } from './song'

export function memoryLibrary(initial?: Partial<LibrarySnapshot>): LibraryRepository {
  const snapshot: LibrarySnapshot = {
    songs: [...(initial?.songs ?? [])],
    setlists: [...(initial?.setlists ?? [])],
    settings: initial?.settings ?? defaultSettings(),
  }
  return {
    async load() {
      return structuredClone(snapshot)
    },
    async saveSong(song: Song) {
      const index = snapshot.songs.findIndex((item) => item.id === song.id)
      if (index < 0) snapshot.songs.push(structuredClone(song))
      else snapshot.songs[index] = structuredClone(song)
    },
    async deleteSong(id: string) {
      snapshot.songs = snapshot.songs.filter((song) => song.id !== id)
      snapshot.setlists = snapshot.setlists.map((setlist) => ({ ...setlist, entries: setlist.entries.filter((entry) => entry.songId !== id) }))
    },
    async saveSetlist(setlist: Setlist) {
      const index = snapshot.setlists.findIndex((item) => item.id === setlist.id)
      if (index < 0) snapshot.setlists.push(structuredClone(setlist))
      else snapshot.setlists[index] = structuredClone(setlist)
    },
    async deleteSetlist(id: string) {
      snapshot.setlists = snapshot.setlists.filter((setlist) => setlist.id !== id)
    },
    async saveSettings(settings: Settings) {
      snapshot.settings = structuredClone(settings)
    },
  }
}
