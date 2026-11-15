import { formatKey, type Key } from './chord'
import type { Setlist, SetlistEntry } from './library-types'
import type { Song } from './song'

/** Adds a song at the end of a setlist, in the key and capo it is being viewed in. The song itself is unchanged. */
export function addSongToSetlist(setlist: Setlist, song: Song, view: { concert: Key; capo: number }): Setlist {
  const entry: SetlistEntry = { songId: song.id }
  if (formatKey(view.concert) !== formatKey(song.originalKey)) entry.key = view.concert
  if (view.capo > 0) entry.capo = view.capo
  return { ...setlist, entries: [...setlist.entries, entry] }
}

/** Undated drafts first, since they are being planned, then the newest service date. */
export function setlistsNewestFirst(setlists: Setlist[]): Setlist[] {
  return [...setlists].sort((a, b) => {
    if (!a.date !== !b.date) return a.date ? 1 : -1
    return b.date.localeCompare(a.date)
  })
}
