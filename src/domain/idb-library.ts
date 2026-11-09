import { openDB } from 'idb'
import { defaultSettings, type LibraryRepository, type LibrarySnapshot } from './library-types'
import type { Song } from './song'

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
  return {
    async load() {
      const database = await db()
      const [songs, setlists, settings] = await Promise.all([
        database.getAll('songs'),
        database.getAll('setlists'),
        database.get('meta', 'settings'),
      ])
      return { songs, setlists, settings: settings ?? defaultSettings() } satisfies LibrarySnapshot
    },
    async saveSong(song: Song) {
      await (await db()).put('songs', song)
    },
    async deleteSong(id: string) {
      const database = await db()
      await database.delete('songs', id)
      const setlists = await database.getAll('setlists')
      for (const setlist of setlists) {
        setlist.entries = setlist.entries.filter((entry: { songId: string }) => entry.songId !== id)
        await database.put('setlists', setlist)
      }
    },
    async saveSetlist(setlist) {
      await (await db()).put('setlists', setlist)
    },
    async deleteSetlist(id) {
      await (await db()).delete('setlists', id)
    },
    async saveSettings(settings) {
      await (await db()).put('meta', settings, 'settings')
    },
  }
}
