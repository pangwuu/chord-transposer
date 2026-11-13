import type { LibraryRepository, LibrarySnapshot, Setlist } from './library-types'
import type { Song } from './song'

type Listener = (snapshot: LibrarySnapshot) => void

/** A library held in memory: the contract's reference adapter, and the library of test mode's band. */
export function memoryLibrary(initial?: Partial<LibrarySnapshot>): LibraryRepository {
  const snapshot: LibrarySnapshot = {
    songs: structuredClone(initial?.songs ?? []),
    setlists: structuredClone(initial?.setlists ?? []),
  }
  const listeners = new Set<Listener>()
  const changed = () => {
    for (const listener of [...listeners]) listener(structuredClone(snapshot))
  }
  return {
    subscribe(onChange) {
      listeners.add(onChange)
      queueMicrotask(() => {
        if (listeners.has(onChange)) onChange(structuredClone(snapshot))
      })
      return () => {
        listeners.delete(onChange)
      }
    },
    async saveSong(song: Song) {
      const index = snapshot.songs.findIndex((item) => item.id === song.id)
      if (index < 0) snapshot.songs.push(structuredClone(song))
      else snapshot.songs[index] = structuredClone(song)
      changed()
    },
    async deleteSong(id: string) {
      snapshot.songs = snapshot.songs.filter((song) => song.id !== id)
      snapshot.setlists = snapshot.setlists.map((setlist) => ({ ...setlist, entries: setlist.entries.filter((entry) => entry.songId !== id) }))
      changed()
    },
    async saveSetlist(setlist: Setlist) {
      const index = snapshot.setlists.findIndex((item) => item.id === setlist.id)
      if (index < 0) snapshot.setlists.push(structuredClone(setlist))
      else snapshot.setlists[index] = structuredClone(setlist)
      changed()
    },
    async deleteSetlist(id: string) {
      snapshot.setlists = snapshot.setlists.filter((setlist) => setlist.id !== id)
      changed()
    },
  }
}
