import { describe, expect, it } from 'vitest'
import { formatKey, parseKey } from './chord'
import type { Setlist } from './library-types'
import { prefsForBias } from './chord'
import { addSongToSetlist, lastPlayed, lastPlayedLabel, removeSongFromSetlists, restoreSongEntries, runningOrderText, setlistsNewestFirst, todayDate } from './setlist'
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

describe('when a song was last played', () => {
  const today = '2026-03-10'
  const past = (id: string, date: string, entries: Setlist['entries'], name = id): Setlist => ({ id, name, date, entries })

  it('is unknown with no setlists, or none that have happened', () => {
    expect(lastPlayed(song, [], today)).toBeNull()
    expect(lastPlayed(song, [past('next', '2026-03-15', [{ songId: 'grace' }])], today)).toBeNull()
    expect(lastPlayed(song, [past('other', '2026-03-01', [{ songId: 'someone-else' }])], today)).toBeNull()
  })

  it('ignores undated drafts and a setlist dated today', () => {
    expect(lastPlayed(song, [past('draft', '', [{ songId: 'grace' }]), past('tonight', today, [{ songId: 'grace' }])], today)).toBeNull()
  })

  it('takes the most recent past setlist, whatever order they are held in', () => {
    const lists = [
      past('feb', '2026-02-01', [{ songId: 'grace', key: parseKey('A') }], 'February'),
      past('mar', '2026-03-03', [{ songId: 'grace', key: parseKey('E'), capo: 2 }], 'Sunday'),
      past('jan', '2026-01-04', [{ songId: 'grace', key: parseKey('C') }], 'January'),
      past('later', '2026-04-01', [{ songId: 'grace', key: parseKey('D') }], 'April'),
    ]
    const played = lastPlayed(song, lists, today)
    expect(played && { ...played, key: formatKey(played.key) }).toEqual({ date: '2026-03-03', key: 'E', capo: 2, setlistName: 'Sunday' })
  })

  it('falls back to the song\'s own key and no capo when the entry has none', () => {
    const played = lastPlayed(song, [past('mar', '2026-03-03', [{ songId: 'grace' }])], today)
    expect(played && formatKey(played.key)).toBe('G')
    expect(played?.capo).toBe(0)
  })

  it('uses the first entry when the song is in one setlist twice', () => {
    const played = lastPlayed(song, [past('mar', '2026-03-03', [{ songId: 'grace', key: parseKey('A') }, { songId: 'grace', key: parseKey('C') }])], today)
    expect(played && formatKey(played.key)).toBe('A')
  })

  it('reads as a short hint, with the year only when it is not this year', () => {
    const played = (date: string, capo = 0) => ({ date, key: parseKey('A'), capo, setlistName: 'Sunday' })
    expect(lastPlayedLabel(null, today, 'en-GB')).toBe('Not played yet')
    expect(lastPlayedLabel(played('2026-03-03'), today, 'en-GB')).toBe('Last played 3 Mar · A')
    expect(lastPlayedLabel(played('2026-03-03', 2), today, 'en-GB')).toBe('Last played 3 Mar · A · Capo 2')
    expect(lastPlayedLabel(played('2025-12-25'), today, 'en-GB')).toBe('Last played 25 Dec 2025 · A')
    expect(lastPlayedLabel(played('2026-03-03'), today, 'en-US')).toBe('Last played Mar 3 · A')
  })

  it('names today on the local calendar', () => {
    expect(todayDate(new Date(2026, 2, 3, 23, 30))).toBe('2026-03-03')
  })
})

describe('the running order as text', () => {
  const grace = emptySong({ id: 'grace', title: 'Amazing Grace', originalKey: parseKey('G') })
  const light = emptySong({ id: 'light', title: 'First Light', originalKey: parseKey('C') })
  const abide = emptySong({ id: 'abide', title: 'Abide With Me', originalKey: parseKey('Eb') })
  const songs = [grace, light, abide]
  const set: Setlist = {
    id: 'sun',
    name: 'Sunday',
    date: '2026-03-01',
    entries: [{ songId: 'grace' }, { songId: 'light', key: parseKey('D'), capo: 2 }, { songId: 'abide', notes: 'Start a cappella' }],
  }

  it('gives the name and date, then one numbered line a song', () => {
    expect(runningOrderText(set, songs, undefined, 'en-GB')).toBe(
      ['Sunday · Sun 1 Mar', '1. Amazing Grace — G', '2. First Light — D, capo 2 (C shapes)', '3. Abide With Me — Eb · Start a cappella'].join('\n'),
    )
  })

  it('copes with no name and no date', () => {
    expect(runningOrderText({ ...set, name: ' ', date: '', entries: [{ songId: 'grace' }] }, songs, undefined, 'en-GB')).toBe('Untitled setlist\n1. Amazing Grace — G')
    expect(runningOrderText({ ...set, date: '', entries: [] }, songs, undefined, 'en-GB')).toBe('Sunday')
  })

  it('says when a song is missing, and joins notes written on several lines', () => {
    const text = runningOrderText({ ...set, entries: [{ songId: 'gone' }, { songId: 'grace', notes: 'Soft start\n  build on chorus 2 \n' }] }, songs, undefined, 'en-GB')
    expect(text.split('\n').slice(1)).toEqual(['1. Missing song', '2. Amazing Grace — G · Soft start build on chorus 2'])
  })

  it('spells keys the way this device prefers', () => {
    const entries = [{ songId: 'abide' }, { songId: 'grace', key: parseKey('F#'), capo: 1 }]
    const lines = (bias: 'flats' | 'sharps') => runningOrderText({ ...set, entries }, songs, prefsForBias(bias), 'en-GB').split('\n').slice(1)
    expect(lines('flats')).toEqual(['1. Abide With Me — Eb', '2. Amazing Grace — Gb, capo 1 (F shapes)'])
    expect(lines('sharps')).toEqual(['1. Abide With Me — Eb', '2. Amazing Grace — F#, capo 1 (F shapes)'])
  })
})

describe('undoing a deleted song', () => {
  const a = { songId: 'a' }
  const b = { songId: 'b', notes: 'quiet' }
  const first = { songId: 'grace', key: parseKey('A'), capo: 2, notes: 'Opener' }
  const second = { songId: 'grace' }
  const lists: Setlist[] = [
    { id: 'one', name: 'One', date: '', entries: [first, a, second, b] },
    { id: 'two', name: 'Two', date: '', entries: [a, b, { songId: 'grace', notes: 'Closer' }] },
    { id: 'three', name: 'Three', date: '', entries: [a] },
  ]

  it('comes back at the same positions with identical entries in every setlist', () => {
    const { setlists: without, removed } = removeSongFromSetlists(lists, 'grace')
    expect(without.map((list) => list.entries.map((entry) => entry.songId))).toEqual([['a', 'b'], ['a', 'b'], ['a']])
    const { setlists: back, changed } = restoreSongEntries(without, removed)
    expect(back).toEqual(lists)
    expect(changed.map((list) => list.id)).toEqual(['one', 'two'])
  })

  it('leaves a setlist deleted in the meantime alone, and still fits a shortened one', () => {
    const { setlists: without, removed } = removeSongFromSetlists(lists, 'grace')
    const shortened = without.filter((list) => list.id !== 'two').map((list) => (list.id === 'one' ? { ...list, entries: [] } : list))
    const { setlists: back } = restoreSongEntries(shortened, removed)
    expect(back.map((list) => list.id)).toEqual(['one', 'three'])
    expect(back[0].entries).toEqual([first, second])
  })
})
