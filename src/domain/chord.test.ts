import { describe, expect, it } from 'vitest'
import {
  formatChord,
  formatKey,
  formatNote,
  formatSymbol,
  friendlyCapos,
  normaliseSymbol,
  nashville,
  parseChord,
  parseKey,
  shiftKey,
  spellPitch,
  suggestionsFor,
  transposeSymbol,
} from './chord'

const C = parseKey('C')
const F = parseKey('F')
const E = parseKey('E')
const B = parseKey('B')
const G = parseKey('G')
const D = parseKey('D')

describe('parseChord', () => {
  it('parses slash chords, flats, and qualities without rewriting them', () => {
    expect(formatSymbol(parseChord('F/A'))).toBe('F/A')
    expect(formatSymbol(parseChord('Bb'))).toBe('Bb')
    expect(formatSymbol(parseChord('F#sus'))).toBe('F#sus')
    expect(formatSymbol(parseChord('D#m'))).toBe('D#m')
    expect(formatSymbol(parseChord('Cmaj7'))).toBe('Cmaj7')
    expect(formatSymbol(parseChord('CM7'))).toBe('CM7')
    expect(formatSymbol(parseChord('CΔ7'))).toBe('CΔ7')
    expect(formatSymbol(parseChord('Csus'))).toBe('Csus')
    expect(formatSymbol(parseChord('Cmin'))).toBe('Cmin')
    expect(formatSymbol(parseChord('Bbbm'))).toBe('Bbbm')
    expect(formatSymbol(parseChord('C##'))).toBe('C##')
  })

  it('keeps no-chord marks and flags text that is not a chord', () => {
    expect(parseChord('N.C.')).toEqual({ kind: 'nc', raw: 'N.C.' })
    expect(parseChord('NC')).toEqual({ kind: 'nc', raw: 'NC' })
    expect(parseChord('Hx7')).toEqual({ kind: 'invalid', raw: 'Hx7' })
    expect(parseChord('H7')).toEqual({ kind: 'invalid', raw: 'H7' })
    expect(parseChord('Cfoo')).toEqual({ kind: 'invalid', raw: 'Cfoo' })
  })

  it('normalises aliases only when asked', () => {
    expect(formatSymbol(normaliseSymbol(parseChord('Cmin')))).toBe('Cm')
    expect(formatSymbol(normaliseSymbol(parseChord('CM7')))).toBe('Cmaj7')
    expect(formatSymbol(normaliseSymbol(parseChord('CΔ7')))).toBe('Cmaj7')
    expect(formatSymbol(normaliseSymbol(parseChord('Csus')))).toBe('Csus4')
    expect(formatSymbol(parseChord('Cmin'))).toBe('Cmin')
  })
})

describe('spelling and transpose', () => {
  it('spells the C chromatic notes with Bb and F#', () => {
    const names = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((pitch) => formatNoteSafe(pitch))
    expect(names).toEqual(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])
  })

  it('turns F/A in F into E/G# in E, and Bb into A', () => {
    const slash = transposeSymbol(parseChord('F/A'), -1, E)
    const flat = transposeSymbol(parseChord('Bb'), -1, E)
    expect(formatSymbol(slash)).toBe('E/G#')
    expect(formatSymbol(flat)).toBe('A')
    expect(formatKey(F)).toBe('F')
  })

  it('spells a III chord in B as D#m and the other B-key examples', () => {
    expect(formatSymbol(transposeSymbol(parseChord('D#m'), 0, B))).toBe('D#m')
    expect(suggestionsFor(B).map((item) => item.symbol)).toContain('D#m')
    expect(formatSymbol(transposeSymbol(parseChord('F#'), 0, B))).toBe('F#')
    expect(formatSymbol(transposeSymbol(parseChord('C#m'), 0, B))).toBe('C#m')
    expect(formatSymbol(transposeSymbol(parseChord('G#m'), 0, B))).toBe('G#m')
    expect(formatSymbol(transposeSymbol(parseChord('E/G#'), 0, B))).toBe('E/G#')
  })

  it('shows G shapes for capo 4 in B, including F#sus as Dsus', () => {
    const shapes = shiftKey(B, -4)
    expect(formatKey(shapes)).toBe('G')
    expect(formatSymbol(transposeSymbol(parseChord('F#sus'), -4, shapes))).toBe('Dsus')
    expect(friendlyCapos(B)).toContainEqual({ capo: 4, shapes: 'G' })
  })

  it('returns every generated chord after moving up and back', () => {
    const qualities = ['', 'm', '7', 'maj7', 'm7', 'sus', 'sus2', 'sus4', 'add9', '2', '5', '6', 'm6', '9', 'dim', 'dim7', 'aug', 'm7b5']
    const notes = Array.from({ length: 12 }, (_, pitch) => formatNote(spellPitch(pitch, C)))
    for (const root of notes) {
      for (const quality of qualities) {
        for (const bass of ['', ...notes.map((note) => `/${note}`)]) {
          const parsed = parseChord(`${root}${quality}${bass}`)
          for (let steps = 1; steps <= 11; steps += 1) {
            const back = transposeSymbol(transposeSymbol(parsed, steps, shiftKey(C, steps)), -steps, C)
            expect(formatSymbol(back)).toBe(formatSymbol(parsed))
          }
        }
      }
    }
    expect(formatSymbol(transposeSymbol(transposeSymbol(parseChord('Cb'), 3, shiftKey(C, 3)), -3, C))).toBe('B')
    expect(formatSymbol(transposeSymbol(transposeSymbol(parseChord('B#'), 5, shiftKey(C, 5)), -5, C))).toBe('C')
    expect(formatSymbol(transposeSymbol(transposeSymbol(parseChord('Fbmaj7'), 2, shiftKey(C, 2)), -2, C))).toBe('Emaj7')
    expect(formatSymbol(transposeSymbol(parseChord('N.C.'), 5, G))).toBe('N.C.')
  })

  it('returns the original chord text after moving up and back', () => {
    const originals = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Dm7', 'F/A', 'Bbmaj7', 'Csus', 'N.C.']
    for (const original of originals) {
      for (const steps of [1, 3, 6, 7, 11]) {
        const there = shiftKey(C, steps)
        const moved = transposeSymbol(parseChord(original), steps, there)
        const back = transposeSymbol(moved, -steps, C)
        expect(formatSymbol(back)).toBe(formatSymbol(parseChord(original)))
      }
    }
  })

  it('spells a handwritten transpose from C up two semitones into D', () => {
    const from = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
    const to = ['D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#']
    const spelled = from.map((name) => formatSymbol(transposeSymbol(parseChord(name), 2, D)))
    expect(spelled).toEqual(to)
    expect(formatKey(G)).toBe('G')
  })

  it('does not transpose N.C. or an unrecognised chord', () => {
    expect(formatSymbol(transposeSymbol(parseChord('N.C.'), 5, G))).toBe('N.C.')
    expect(formatSymbol(transposeSymbol(parseChord('Hx7'), 5, G))).toBe('Hx7')
  })
})

describe('nashville and suggestions', () => {
  it('numbers chords from the key, including a slash bass', () => {
    expect(nashville(parseChord('C'), C)).toBe('1')
    expect(nashville(parseChord('F'), C)).toBe('4')
    expect(nashville(parseChord('Gsus'), C)).toBe('5sus')
    expect(nashville(parseChord('Dm'), C)).toBe('2m')
    expect(nashville(parseChord('Bb'), C)).toBe('b7')
    expect(nashville(parseChord('F/A'), C)).toBe('4/6')
    expect(nashville(parseChord('D/F#'), C)).toBe('2/#4')
  })

  it('offers the diatonic chords of C and the borrowed flats', () => {
    const symbols = suggestionsFor(C).map((item) => `${item.symbol} ${item.numeral}`)
    expect(symbols).toContain('C I')
    expect(symbols).toContain('Dm ii')
    expect(symbols).toContain('Bdim vii°')
    expect(symbols).toContain('C/E I/3')
    expect(symbols).toContain('F/A IV/6')
    expect(symbols).toContain('Bb bVII')
    expect(symbols).toContain('Ab bVI')
    expect(symbols).toContain('Eb bIII')
  })
})

function formatNoteSafe(pitch: number): string {
  const note = spellPitch(pitch, C)
  return formatChord({ root: note, quality: '', raw: '' })
}
