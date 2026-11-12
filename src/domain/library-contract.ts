import { describe, expect, it, vi } from 'vitest'
import { amazingGrace, firstLight } from '../fixtures/charts'
import type { LibraryRepository, LibrarySnapshot, Setlist } from './library-types'

const sunday: Setlist = {
  id: 'set-1',
  name: 'Sunday',
  date: '2026-03-01',
  entries: [{ songId: firstLight.id }, { songId: amazingGrace.id }],
}

/** What every library adapter must do. Each adapter's test file runs this against a fresh, empty library. */
export function libraryContract(name: string, fresh: () => LibraryRepository | Promise<LibraryRepository>) {
  /** Subscribes and records every snapshot delivered. */
  function watch(library: LibraryRepository) {
    const seen: LibrarySnapshot[] = []
    const stop = library.subscribe((snapshot) => seen.push(snapshot))
    const latest = () => seen[seen.length - 1]
    return { seen, stop, latest }
  }

  describe(`${name} library`, () => {
    it('delivers an empty library to a new subscriber', async () => {
      const watching = watch(await fresh())
      await vi.waitFor(() => expect(watching.latest()).toEqual({ songs: [], setlists: [] }))
      watching.stop()
    })

    it('delivers a saved song, and the newer copy when it is saved again', async () => {
      const library = await fresh()
      const watching = watch(library)
      await library.saveSong(firstLight)
      await vi.waitFor(() => expect(watching.latest()?.songs).toEqual([firstLight]))
      await library.saveSong({ ...firstLight, title: 'Second Light' })
      await vi.waitFor(() => expect(watching.latest()?.songs.map((song) => song.title)).toEqual(['Second Light']))
      watching.stop()
    })

    it('delivers what was saved before the subscription began', async () => {
      const library = await fresh()
      await library.saveSong(firstLight)
      await library.saveSetlist(sunday)
      const watching = watch(library)
      await vi.waitFor(() => expect(watching.latest()).toEqual({ songs: [firstLight], setlists: [sunday] }))
      watching.stop()
    })

    it('deletes a song and drops it from every setlist', async () => {
      const library = await fresh()
      const watching = watch(library)
      await library.saveSong(firstLight)
      await library.saveSong(amazingGrace)
      await library.saveSetlist(sunday)
      await library.saveSetlist({ ...sunday, id: 'set-2', entries: [{ songId: firstLight.id, capo: 2 }] })
      await library.deleteSong(firstLight.id)
      await vi.waitFor(() => {
        expect(watching.latest()?.songs.map((song) => song.id)).toEqual([amazingGrace.id])
        expect(watching.latest()?.setlists.map((setlist) => setlist.entries)).toEqual([[{ songId: amazingGrace.id }], []])
      })
      watching.stop()
    })

    it('saves, replaces and deletes a setlist', async () => {
      const library = await fresh()
      const watching = watch(library)
      await library.saveSetlist(sunday)
      await library.saveSetlist({ ...sunday, name: 'Easter' })
      await vi.waitFor(() => expect(watching.latest()?.setlists).toEqual([{ ...sunday, name: 'Easter' }]))
      await library.deleteSetlist(sunday.id)
      await vi.waitFor(() => expect(watching.latest()?.setlists).toEqual([]))
      watching.stop()
    })

    it('delivers every change to every subscriber', async () => {
      const library = await fresh()
      const one = watch(library)
      const two = watch(library)
      await library.saveSong(firstLight)
      await vi.waitFor(() => {
        expect(one.latest()?.songs).toEqual([firstLight])
        expect(two.latest()?.songs).toEqual([firstLight])
      })
      one.stop()
      two.stop()
    })

    it('stops delivering after unsubscribe', async () => {
      const library = await fresh()
      const stopped = watch(library)
      const kept = watch(library)
      await vi.waitFor(() => expect(stopped.latest()).toBeDefined())
      stopped.stop()
      const before = stopped.seen.length
      await library.saveSong(firstLight)
      await vi.waitFor(() => expect(kept.latest()?.songs).toEqual([firstLight]))
      expect(stopped.seen).toHaveLength(before)
      kept.stop()
    })
  })
}
