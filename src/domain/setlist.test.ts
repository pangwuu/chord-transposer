import { describe, expect, it } from 'vitest'
import { formatKey, parseKey } from './chord'
import type { Setlist } from './library-types'
import { addSongToSetlist, setlistsNewestFirst } from './setlist'
import { emptySong } from './song'

const song = emptySong({ id: 'grace', title: 'Amazing Grace', originalKey: parseKey('G') })
const sunday: Setlist = { id: 'sun', name: 'Sunday', date: '2026-03-01', entries: [{ songId: 'other' }] }

describe('adding the open song to a setlist', () => {
  it('appends it in its own key when it is not transposed', () => {
    expect(addSongToSetlist(sunday, song, { concert: parseKey('G'), capo: 0 }).entries).toEqual([{ songId: 'other' }, { songId: 'grace' }])
  })

  it('keeps the key and capo it is being viewed in, for that service only', () => {
    const entry = addSongToSetlist(sunday, song, { concert: parseKey('A'), capo: 2 }).entries[1]
    expect(entry.songId).toBe('grace')
    expect(entry.key && formatKey(entry.key)).toBe('A')
    expect(entry.capo).toBe(2)
  })
})

describe('choosing a setlist', () => {
  it('puts undated drafts first, then the newest date', () => {
    const lists: Setlist[] = [
      { id: 'old', name: 'Old', date: '2025-12-25', entries: [] },
      { id: 'next', name: 'Next', date: '2026-03-08', entries: [] },
      { id: 'draft', name: 'Draft', date: '', entries: [] },
      { id: 'sun', name: 'Sunday', date: '2026-03-01', entries: [] },
    ]
    expect(setlistsNewestFirst(lists).map((list) => list.id)).toEqual(['draft', 'next', 'sun', 'old'])
  })
})
