import { openDB } from 'idb'
import type { LibraryRepository } from './library-types'
import { memoryLibrary } from './memory-library'

const DB = 'chord-sheet-maker'

export function idbLibrary(): LibraryRepository {
  const db = () =>
    openDB(DB, 1, {
      upgrade(database) {
        database.createObjectStore('songs', { keyPath: 'id' })
        database.createObjectStore('setlists', { keyPath: 'id' })
        database.createObjectStore('meta')
      },
    })
  // The working copy, read once. Every write lands here first, so a snapshot never lags this device's own edits.
  const working = (async () => {
    const database = await db()
    const [songs, setlists] = await Promise.all([database.getAll('songs'), database.getAll('setlists')])
    return memoryLibrary({ songs, setlists })
  })()
  working.catch(() => {})
  return {
    subscribe(onChange, onError) {
      let stopped = false
      let stop = () => {}
      working.then(
        (copy) => {
          if (!stopped) stop = copy.subscribe(onChange)
        },
        (error) => {
          if (!stopped) onError?.(error)
        },
      )
      return () => {
        stopped = true
        stop()
      }
    },
    async saveSong(song) {
      await (await working).saveSong(song)
      await (await db()).put('songs', song)
    },
    async deleteSong(id) {
      await (await working).deleteSong(id)
      const database = await db()
      await database.delete('songs', id)
      const setlists = await database.getAll('setlists')
      for (const setlist of setlists) {
        setlist.entries = setlist.entries.filter((entry: { songId: string }) => entry.songId !== id)
        await database.put('setlists', setlist)
      }
    },
    async saveSetlist(setlist) {
      await (await working).saveSetlist(setlist)
      await (await db()).put('setlists', setlist)
    },
    async deleteSetlist(id) {
      await (await working).deleteSetlist(id)
      await (await db()).delete('setlists', id)
    },
  }
}
