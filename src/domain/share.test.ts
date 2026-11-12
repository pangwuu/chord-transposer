import { describe, expect, it } from 'vitest'
import { amazingGrace, firstLight } from '../fixtures/charts'
import type { Setlist } from './library-types'
import { bundleSetlist, encodeBundle, encodeShare, mergeBundle, readShare } from './share'

const sunday: Setlist = {
  id: 'set-sunday',
  name: 'Sunday',
  date: '2026-03-01',
  entries: [{ songId: firstLight.id, capo: 2, notes: 'Slow intro' }],
}

describe('sharing a setlist', () => {
  it('carries the setlist and only the songs it uses through a link', () => {
    const encoded = encodeBundle(bundleSetlist(sunday, [amazingGrace, firstLight]))
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    const bundle = readShare(encoded.hash)
    expect(bundle.setlist).toEqual(sunday)
    expect(bundle.songs.map((song) => song.title)).toEqual(['First Light'])
  })
})

describe('reading what was shared', () => {
  it('reads an older single-song link as a bundle of one song', () => {
    const encoded = encodeShare(firstLight)
    if (!encoded.ok) throw new Error('fixture too large')
    const bundle = readShare(encoded.hash)
    expect(bundle.setlist).toBeUndefined()
    expect(bundle.songs.map((song) => song.id)).toEqual([firstLight.id])
  })

  it('reads a shared setlist file', () => {
    const file = JSON.stringify(bundleSetlist(sunday, [firstLight]), null, 2)
    expect(readShare(file).setlist?.name).toBe('Sunday')
  })

  it('refuses anything that is not a well-formed bundle', () => {
    const pack = (value: unknown) => JSON.stringify(value)
    expect(() => readShare('hello')).toThrow()
    expect(() => readShare('2.not-gzip')).toThrow()
    expect(() => readShare(pack({ version: 3, songs: [] }))).toThrow()
    expect(() => readShare(pack({ version: 2, songs: [{ id: 'x', title: 'No sections' }] }))).toThrow()
    expect(() => readShare(pack({ version: 2, songs: [{ ...firstLight, sections: [{ id: 's', label: 'V', kind: 'verse', lines: [{ id: 'l', type: 'video' }] }] }] }))).toThrow()
    expect(() => readShare(pack({ version: 2, songs: [], setlist: { id: 's', name: 'Bad', date: '', entries: [{ song: 1 }] } }))).toThrow()
    expect(() => readShare(pack({ version: 2, songs: [], setlist: { ...sunday } }))).toThrow(/missing/i)
  })
})

describe('adding a bundle to a library', () => {
  const older = { ...firstLight, updatedAt: '2026-01-01T00:00:00.000Z' }
  const newer = { ...firstLight, title: 'First Light (fixed)', updatedAt: '2026-02-01T00:00:00.000Z' }

  it('adds songs and a setlist the library does not have', () => {
    const plan = mergeBundle({ songs: [amazingGrace], setlists: [] }, bundleSetlist(sunday, [firstLight]))
    expect(plan.added.map((song) => song.id)).toEqual([firstLight.id])
    expect(plan.updated).toEqual([])
    expect(plan.setlist).toEqual({ status: 'new', value: sunday })
  })

  it('offers an update when the shared song is newer, and keeps a local copy that is newer', () => {
    expect(mergeBundle({ songs: [older], setlists: [] }, { version: 2, songs: [newer] }).updated.map((song) => song.title)).toEqual(['First Light (fixed)'])
    const kept = mergeBundle({ songs: [newer], setlists: [] }, { version: 2, songs: [older] })
    expect(kept.added).toEqual([])
    expect(kept.updated).toEqual([])
  })

  it('tells a changed setlist from one already held', () => {
    const reordered = { ...sunday, name: 'Sunday evening' }
    expect(mergeBundle({ songs: [firstLight], setlists: [sunday] }, bundleSetlist(sunday, [firstLight])).setlist?.status).toBe('same')
    expect(mergeBundle({ songs: [firstLight], setlists: [sunday] }, bundleSetlist(reordered, [firstLight])).setlist?.status).toBe('changed')
  })
})
