import { describe, expect, it } from 'vitest'
import { formatSymbol, nashville, easyChord, parseChord, parseKey } from './chord'
import { fromChordPro } from './chordpro'
import { chordSummary, compactOrder, displayedSong, emptySong, findDuplicate, findSongs, onlySeededSongs, sortSongs, type Song, type SongSort } from './song'

function song(title: string, key: string, createdAt: string | undefined, updatedAt: string, lyric = '', artist?: string): Song {
  const made = emptySong({ id: title, title, artist, originalKey: parseKey(key), createdAt, updatedAt })
  const line = made.sections[0].lines[0]
  if (line.type === 'lyric') line.text = lyric
  return made
}

const library = [
  song('Cornerstone', 'C', '2026-03-01T10:00:00Z', '2026-05-01T10:00:00Z', 'my hope is built'),
  song('Abide With Me', 'Eb', '2026-01-01T10:00:00Z', '2026-06-01T10:00:00Z', 'fast falls the eventide'),
  song('Build My Life', 'G', undefined, '2026-02-01T10:00:00Z', 'worthy of every song'),
  song('Be Thou My Vision', 'Em', '2026-04-01T10:00:00Z', '2026-01-01T10:00:00Z', 'lord of my heart'),
  song('Amazing Grace', 'G', undefined, '2026-04-01T10:00:00Z', 'how sweet the sound'),
  song('Doxology', 'C', '2026-02-01T10:00:00Z', '2026-03-01T10:00:00Z', 'praise god'),
]

const titles = (sort: SongSort, query = '') => findSongs(library, query, sort).map((item) => item.title)

describe('the song list order', () => {
  it('sorts by title, A to Z, unless told otherwise', () => {
    expect(findSongs(library, '').map((item) => item.title)).toEqual(['Abide With Me', 'Amazing Grace', 'Be Thou My Vision', 'Build My Life', 'Cornerstone', 'Doxology'])
    expect(titles({ by: 'title', reverse: true })).toEqual(['Doxology', 'Cornerstone', 'Build My Life', 'Be Thou My Vision', 'Amazing Grace', 'Abide With Me'])
  })

  it('sorts by date added, newest first, with undated songs last by title', () => {
    expect(titles({ by: 'added', reverse: false })).toEqual(['Be Thou My Vision', 'Cornerstone', 'Doxology', 'Abide With Me', 'Amazing Grace', 'Build My Life'])
    expect(titles({ by: 'added', reverse: true })).toEqual(['Abide With Me', 'Doxology', 'Cornerstone', 'Be Thou My Vision', 'Amazing Grace', 'Build My Life'])
  })

  it('sorts by date edited, newest first', () => {
    expect(titles({ by: 'edited', reverse: false })).toEqual(['Abide With Me', 'Cornerstone', 'Amazing Grace', 'Doxology', 'Build My Life', 'Be Thou My Vision'])
    expect(titles({ by: 'edited', reverse: true })).toEqual(['Be Thou My Vision', 'Build My Life', 'Doxology', 'Amazing Grace', 'Cornerstone', 'Abide With Me'])
  })

  it('sorts by key from C up to B, major before minor, then by title', () => {
    const minorFirst = [...library, song('Come Thou Fount', 'Cm', undefined, '2026-01-01T10:00:00Z'), song('Everlasting', 'E', undefined, '2026-01-01T10:00:00Z')]
    expect(sortSongs(minorFirst, { by: 'key', reverse: false }).map((item) => `${item.title} (${item.originalKey.tonic.letter}${item.originalKey.tonic.accidental}${item.originalKey.mode === 'minor' ? 'm' : ''})`)).toEqual([
      'Cornerstone (C)', 'Doxology (C)', 'Come Thou Fount (Cm)', 'Abide With Me (Eb)', 'Everlasting (E)', 'Be Thou My Vision (Em)', 'Amazing Grace (G)', 'Build My Life (G)',
    ])
    expect(titles({ by: 'key', reverse: true })).toEqual(['Build My Life', 'Amazing Grace', 'Be Thou My Vision', 'Abide With Me', 'Doxology', 'Cornerstone'])
  })

  it('keeps title matches ahead of lyric matches under every sort while searching', () => {
    const more = [...library, song('Zion', 'D', '2026-06-01T10:00:00Z', '2026-07-01T10:00:00Z', 'my vision of home'), song('My Lighthouse', 'A', '2026-05-01T10:00:00Z', '2026-01-02T10:00:00Z')]
    const found = (sort: SongSort) => findSongs(more, 'my', sort).map((item) => item.title)
    // In the title: Build My Life, Be Thou My Vision, My Lighthouse. In the lyrics only: Cornerstone, Zion.
    expect(found({ by: 'title', reverse: false })).toEqual(['Be Thou My Vision', 'Build My Life', 'My Lighthouse', 'Cornerstone', 'Zion'])
    expect(found({ by: 'title', reverse: true })).toEqual(['My Lighthouse', 'Build My Life', 'Be Thou My Vision', 'Zion', 'Cornerstone'])
    expect(found({ by: 'added', reverse: false })).toEqual(['My Lighthouse', 'Be Thou My Vision', 'Build My Life', 'Zion', 'Cornerstone'])
    expect(found({ by: 'edited', reverse: false })).toEqual(['Build My Life', 'My Lighthouse', 'Be Thou My Vision', 'Zion', 'Cornerstone'])
    expect(found({ by: 'key', reverse: false })).toEqual(['Be Thou My Vision', 'Build My Life', 'My Lighthouse', 'Cornerstone', 'Zion'])
  })

  it('does not reorder the list it was given', () => {
    const before = library.map((item) => item.title)
    sortSongs(library, { by: 'key', reverse: true })
    expect(library.map((item) => item.title)).toEqual(before)
  })
})

describe('chord summary', () => {
  const chart = fromChordPro(`{title: Summary}
{key: G}
{start_of_verse: Verse 1}
[G]One [C]two [G]three [G/B]four
{end_of_verse}
{start_of_chorus: Chorus}
[Em]Five [N.C.]six [Dsus4]seven [Hx]eight
{end_of_chorus}
{start_of_bridge: Bridge}
| Am7 | D | G |
{end_of_bridge}
`)
  const labels = (target: Song, labelOf?: Parameters<typeof chordSummary>[1]) => chordSummary(target, labelOf).map((chord) => chord.label)

  it('lists each chord once in order of first appearance, with slash chords on their own and N.C. left out', () => {
    expect(labels(chart)).toEqual(['G', 'C', 'G/B', 'Em', 'Dsus4', 'Hx', 'Am7', 'D'])
  })

  it('marks an unrecognised chord so it can carry the chart warning', () => {
    expect(chordSummary(chart).filter((chord) => chord.invalid).map((chord) => chord.label)).toEqual(['Hx'])
  })

  it('follows the arrangement, not the written order', () => {
    const [verse, chorus, bridge] = chart.sections
    const rearranged = { ...chart, arrangement: [{ sectionId: bridge.id }, { sectionId: chorus.id }, { sectionId: verse.id }, { sectionId: chorus.id }] }
    expect(labels(rearranged)).toEqual(['Am7', 'D', 'G', 'Em', 'Dsus4', 'Hx', 'C', 'G/B'])
  })

  it('counts chords as they are shown: capo shapes, numbers and easy chords', () => {
    // G with capo 3 over a Bb concert key is played with G shapes; without it, as written in Bb.
    expect(labels(displayedSong(chart, parseKey('Bb'), 0))).toEqual(['Bb', 'Eb', 'Bb/D', 'Gm', 'Fsus4', 'Hx', 'Cm7', 'F'])
    expect(labels(displayedSong(chart, parseKey('Bb'), 3))).toEqual(['G', 'C', 'G/B', 'Em', 'Dsus4', 'Hx', 'Am7', 'D'])
    expect(labels(chart, (symbol) => nashville(symbol, parseKey('G')))).toEqual(['1', '4', '1/3', '6m', '5sus4', 'Hx', '2m7', '5'])
    expect(labels(chart, (symbol) => formatSymbol(easyChord(symbol)))).toEqual(['G', 'C', 'Em', 'D', 'Hx', 'Am'])
  })
})

describe('duplicate songs', () => {
  const have = [song('Amazing Grace', 'G', undefined, '2026-03-03T10:00:00Z'), song('The Old Rugged Cross', 'Bb', undefined, '2026-03-03T10:00:00Z'), song("It's Your Breath", 'A', undefined, '2026-03-03T10:00:00Z')]
  const match = (title: string) => findDuplicate(title, have)?.title ?? null

  it('matches whatever the case, punctuation or spacing', () => {
    expect(match('amazing grace')).toBe('Amazing Grace')
    expect(match('AMAZING GRACE!')).toBe('Amazing Grace')
    expect(match('  Amazing   Grace ')).toBe('Amazing Grace')
    expect(match('Its your breath')).toBe("It's Your Breath")
  })

  it('ignores a leading "The" on either side', () => {
    expect(match('Old Rugged Cross')).toBe('The Old Rugged Cross')
    expect(match('The Amazing Grace')).toBe('Amazing Grace')
  })

  it('does not match on a shared beginning, or on nothing', () => {
    expect(match('Amazing Grace (My Chains Are Gone)')).toBeNull()
    expect(match('Amazing')).toBeNull()
    expect(match('   ')).toBeNull()
    expect(match('Thermal')).toBeNull()
  })
})

describe('small library helpers', () => {
  it('writes the arrangement in a few letters', () => {
    const chart = fromChordPro(`{title: Order}
{key: C}
{start_of_verse: Verse 1}
[C]a
{end_of_verse}
{start_of_chorus: Chorus}
[F]b
{end_of_chorus}
{start_of_verse: Verse 2}
[C]c
{end_of_verse}
{start_of_bridge: Bridge}
[G]d
{end_of_bridge}
`)
    const [v1, chorus, v2, bridge] = chart.sections
    const arranged = { ...chart, arrangement: [{ sectionId: v1.id }, { sectionId: chorus.id }, { sectionId: v2.id }, { sectionId: chorus.id }, { sectionId: bridge.id }, { sectionId: chorus.id, repeat: 2 }] }
    expect(compactOrder(arranged)).toBe('V1 C V2 C B C×2')
  })

  it('knows a library that holds only the seeded songs', () => {
    const [a, b] = library
    expect(onlySeededSongs([], [a.id, b.id])).toBe(true)
    expect(onlySeededSongs([a], [a.id, b.id])).toBe(true)
    expect(onlySeededSongs([a, b], [a.id, b.id])).toBe(true)
    expect(onlySeededSongs([a, library[2]], [a.id, b.id])).toBe(false)
  })

  it('reads a chord the same after every helper', () => {
    expect(formatSymbol(parseChord('G/B'))).toBe('G/B')
  })
})
