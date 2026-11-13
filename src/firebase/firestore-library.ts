import {
  collection,
  deleteDoc,
  doc,
  getDocsFromCache,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type {
  LibraryRepository,
  LibrarySnapshot,
  Setlist,
} from '../domain/library-types'
import type { Song } from '../domain/song'

export type ClosableLibrary = LibraryRepository & { close(): void }

/**
 * The songs and setlists of one band, at `bands/{bandId}`.
 * Writes resolve once they are in the local cache, not when the server confirms them,
 * so saving works the same offline: the SDK sends queued writes when the connection returns.
 */
export function firestoreLibrary(
  db: Firestore,
  bandId: string,
): ClosableLibrary {
  const songs = collection(db, 'bands', bandId, 'songs')
  const setlists = collection(db, 'bands', bandId, 'setlists')
  const listeners = new Set<{
    onChange: (snapshot: LibrarySnapshot) => void
    onError?: (error: unknown) => void
  }>()
  let latest: { songs?: Song[]; setlists?: Setlist[] } = {}
  let failure: unknown = null
  const whole = (): LibrarySnapshot | null =>
    latest.songs && latest.setlists
      ? { songs: latest.songs, setlists: latest.setlists }
      : null
  const deliver = () => {
    const snapshot = whole()
    if (snapshot)
      for (const listener of [...listeners])
        listener.onChange(structuredClone(snapshot))
  }
  const fail = (error: unknown) => {
    failure = error
    for (const listener of [...listeners]) listener.onError?.(error)
  }
  const stops = [
    onSnapshot(
      songs,
      (shot) => {
        latest = {
          ...latest,
          songs: shot.docs.map((item) => item.data() as Song),
        }
        deliver()
      },
      fail,
    ),
    onSnapshot(
      setlists,
      (shot) => {
        latest = {
          ...latest,
          setlists: shot.docs.map((item) => item.data() as Setlist),
        }
        deliver()
      },
      fail,
    ),
  ]
  /** Queues a write. Its promise settles only when the server answers, so a refusal is reported but never awaited. */
  const queue = (write: Promise<void>) => {
    write.catch((error) => console.error('A library change was refused', error))
  }

  return {
    subscribe(onChange, onError) {
      const listener = { onChange, onError }
      listeners.add(listener)
      queueMicrotask(() => {
        if (!listeners.has(listener)) return
        if (failure) return onError?.(failure)
        const snapshot = whole()
        if (snapshot) onChange(structuredClone(snapshot))
      })
      return () => {
        listeners.delete(listener)
      }
    },
    async saveSong(song) {
      queue(setDoc(doc(songs, song.id), song))
    },
    async deleteSong(id) {
      // The cache, not `latest`: the SDK applies this device's writes and reads in order, so it holds a setlist saved a moment ago.
      const held = (await getDocsFromCache(setlists)).docs.map(
        (item) => item.data() as Setlist,
      )
      const batch = writeBatch(db)
      batch.delete(doc(songs, id))
      for (const setlist of held) {
        if (!setlist.entries.some((entry) => entry.songId === id)) continue
        batch.set(doc(setlists, setlist.id), {
          ...setlist,
          entries: setlist.entries.filter((entry) => entry.songId !== id),
        })
      }
      queue(batch.commit())
    },
    async saveSetlist(setlist) {
      queue(setDoc(doc(setlists, setlist.id), setlist))
    },
    async deleteSetlist(id) {
      queue(deleteDoc(doc(setlists, id)))
    },
    close() {
      listeners.clear()
      for (const stop of stops) stop()
    },
  }
}
