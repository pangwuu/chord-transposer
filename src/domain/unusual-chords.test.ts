import { describe, expect, it } from 'vitest'
import { parseChord, parseKey, unusualInKey } from './chord'
import { unusualChords } from './song'
import { amazingGrace, firstLight } from '../fixtures/charts'

const unusual = (key: string, chords: string[]) => chords.filter((chord) => unusualInKey(parseChord(chord), parseKey(key)))

describe('chords unusual for the key', () => {
  it('expects the chords of a major key, in any quality of the same family', () => {
    expect(unusual('G', ['G', 'Gmaj7', 'G6', 'Am', 'Am7', 'Bm', 'C', 'Cadd9', 'D', 'D7', 'Dsus4', 'Em', 'Em7', 'F#dim', 'F#m7b5'])).toEqual([])
    expect(unusual('C', ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'])).toEqual([])
    expect(unusual('Eb', ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Ddim'])).toEqual([])
  })

  it('expects the chords of a minor key and its major V', () => {
    expect(unusual('Am', ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G', 'E', 'E7'])).toEqual([])
    expect(unusual('Em', ['Em', 'F#dim', 'G', 'Am', 'Bm', 'C', 'D', 'B7'])).toEqual([])
  })

  it('expects the common borrowed chords in a major key', () => {
    expect(unusual('G', ['Bb', 'Eb', 'F', 'Cm'])).toEqual([])
    expect(unusual('C', ['Eb', 'Ab', 'Bb', 'Fm'])).toEqual([])
  })

  it('expects II and III as secondary dominants', () => {
    expect(unusual('G', ['A', 'A7', 'B', 'B7'])).toEqual([])
    expect(unusual('C', ['D7', 'E7'])).toEqual([])
  })

  it('flags chords from outside all of those', () => {
    expect(unusual('G', ['F#', 'Ab', 'C#m', 'Dm', 'Fm', 'G#dim', 'Ebm'])).toEqual(['F#', 'Ab', 'C#m', 'Dm', 'Fm', 'G#dim', 'Ebm'])
    expect(unusual('C', ['F#', 'Db', 'Gm', 'Bm'])).toEqual(['F#', 'Db', 'Gm', 'Bm'])
    expect(unusual('Am', ['Bb', 'F#m', 'C#'])).toEqual(['Bb', 'F#m', 'C#'])
  })

  it('gives the same verdict however the chord is spelled', () => {
    expect(unusualInKey(parseChord('A#'), parseKey('F'))).toBe(unusualInKey(parseChord('Bb'), parseKey('F')))
    expect(unusualInKey(parseChord('G#'), parseKey('F'))).toBe(unusualInKey(parseChord('Ab'), parseKey('F')))
    expect(unusualInKey(parseChord('Gb'), parseKey('G'))).toBe(true)
    expect(unusualInKey(parseChord('F#'), parseKey('G'))).toBe(true)
  })

  it('judges a slash chord by its chord, not its bass', () => {
    expect(unusual('G', ['D/F#', 'G/B', 'C/E', 'Em/C#'])).toEqual([])
  })

  it('ignores N.C. and unrecognised chords', () => {
    expect(unusual('G', ['N.C.', 'Hx9'])).toEqual([])
  })

  it('flags nothing in the bundled charts', () => {
    expect(unusualChords(amazingGrace)).toEqual([])
    expect(unusualChords(firstLight)).toEqual([])
  })

  it('lists each unusual chord of a song with where it is, and leaves the song alone', () => {
    const song = structuredClone(amazingGrace)
    const line = song.sections[0].lines[0]
    if (line.type !== 'lyric') throw new Error('expected a lyric line')
    line.chords[2].symbol = parseChord('F#')
    const before = structuredClone(song)
    expect(unusualChords(song)).toEqual([{ id: line.chords[2].id, label: 'F#' }])
    expect(song).toEqual(before)
  })
})
