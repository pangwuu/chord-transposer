import { expect, it } from 'vitest'
import {
  capoLine,
  friendlyCapos,
  readChord,
  shiftKey,
  transposeChord,
  writeChord,
  type Chord,
  type KeyName,
} from './chord'

it('reads a slash chord and writes the same text back', () => {
  const reading = readChord('F/A')
  expect(reading.ok).toBe(true)
  if (!reading.ok) return
  expect(writeChord(reading.chord)).toBe('F/A')
})

it('keeps an unparseable token instead of dropping it', () => {
  const reading = readChord('H7')
  expect(reading.ok).toBe(false)
  if (reading.ok) return
  expect(reading.raw).toBe('H7')
})

it('reads N.C. without turning it into a pitch', () => {
  const reading = readChord('N.C.')
  expect(reading.ok).toBe(true)
  if (!reading.ok) return
  expect(reading.chord.kind).toBe('nc')
  expect(writeChord(reading.chord)).toBe('N.C.')
})

it('reads every listed quality, slash bass, and double accidentals', () => {
  for (const quality of [
    '',
    'm',
    '7',
    'maj7',
    'm7',
    'sus',
    'sus2',
    'sus4',
    'add9',
    '2',
    '5',
    '6',
    'm6',
    '9',
    'dim',
    'dim7',
    'aug',
    'm7b5',
  ]) {
    const text = `C${quality}`
    const reading = readChord(text)
    expect(reading.ok, text).toBe(true)
    if (reading.ok) expect(writeChord(reading.chord)).toBe(text)
  }

  expect(readChord('C##').ok).toBe(true)
  expect(readChord('Fbb7').ok).toBe(true)
  const invalid = readChord('Cxyz')
  expect(invalid.ok).toBe(false)
  if (!invalid.ok) expect(invalid.raw).toBe('Cxyz')
})

it('normalises aliases only when asked, and keeps the written suffix otherwise', () => {
  expect(quality('Cmaj7')).toBe('maj7')
  expect(quality('CM7')).toBe('maj7')
  expect(quality('CΔ7')).toBe('maj7')
  expect(quality('Cmin')).toBe('m')
  expect(quality('Csus')).toBe('sus4')

  expect(written('Cmaj7')).toBe('Cmaj7')
  expect(written('CM7')).toBe('CM7')
  expect(written('CΔ7')).toBe('CΔ7')
  expect(written('Csus')).toBe('Csus')
  expect(normalised('Cmin')).toBe('Cm')
  expect(normalised('Csus')).toBe('Csus4')
  expect(normalised('CM7')).toBe('Cmaj7')
})

it('transposes F/A in F to E/G# in E, and Bb in F to A in E', () => {
  expect(moved('F/A', 'F', 'E')).toBe('E/G#')
  expect(moved('Bb', 'F', 'E')).toBe('A')
})

it('spells B-key chords with sharps', () => {
  expect(moved('G', 'C', 'B')).toBe('F#')
  expect(moved('Em', 'C', 'B')).toBe('D#m')
  expect(moved('Am', 'C', 'B')).toBe('G#m')
})

it('spells scale degrees that need E#, B#, and Cb', () => {
  expect(moved('B', 'C', 'F#')).toBe('E#')
  expect(moved('B', 'C', 'C#')).toBe('B#')
  expect(moved('F', 'C', 'Gb')).toBe('Cb')
  expect(moved('E#', 'F#', 'C')).toBe('B')
  expect(moved('Cb', 'Gb', 'C')).toBe('F')
})

it('does not respell a chord when the key stays put', () => {
  expect(moved('Db', 'C', 'C')).toBe('Db')
  expect(moved('E#', 'F#', 'F#')).toBe('E#')
  expect(moved('F#', 'F#', 'Gb')).toBe('Gb')
  expect(moved('Gb', 'Gb', 'F#')).toBe('F#')
})

it('steps the sounding key by a semitone, defaulting to F# and Db', () => {
  expect(shiftKey('C', 1)).toBe('Db')
  expect(shiftKey('C', 6)).toBe('F#')
  expect(shiftKey('B', 1)).toBe('C')
  expect(shiftKey('Db', -1)).toBe('C')
  expect(moved(moved('Bb', 'F', 'E'), 'E', 'F')).toBe('Bb')
})

it('does not transpose N.C.', () => {
  expect(moved('N.C.', 'C', 'F#')).toBe('N.C.')
})

it('keeps the written suffix while moving the root', () => {
  expect(moved('CM7', 'C', 'D')).toBe('DM7')
  expect(moved('CΔ7', 'C', 'D')).toBe('DΔ7')
})

it('describes capo 4 in B as G shapes', () => {
  expect(capoLine('B', 4)).toBe('Capo 4 — play G shapes (sounds in B)')
  expect(friendlyCapos('B')).toContainEqual({ capo: 4, shapeKey: 'G' })
})

it('returns the original chord text after transposing away and back', () => {
  const sharpKeys: KeyName[] = [
    'G',
    'D',
    'A',
    'E',
    'B',
    'F#',
    'C#',
    'Em',
    'F#m',
    'D#m',
  ]
  const flatKeys: KeyName[] = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Cm']
  const naturalKeys: KeyName[] = ['C', 'Am']
  const groups: { keys: KeyName[]; chords: string[] }[] = [
    { keys: sharpKeys, chords: ['F#', 'D#m', 'G#m', 'E/G#', 'C#7', 'Amaj7'] },
    { keys: flatKeys, chords: ['Bb', 'Eb', 'Ab', 'Gm', 'C/E', 'Bbmaj7'] },
    {
      keys: naturalKeys,
      chords: ['C', 'F#', 'Bb', 'D/F#', 'Am', 'Cmaj7', 'CM7', 'CΔ7'],
    },
  ]

  for (const group of groups) {
    for (const from of group.keys) {
      for (const to of [...sharpKeys, ...flatKeys, ...naturalKeys]) {
        for (const text of group.chords) {
          expect(moved(moved(text, from, to), to, from)).toBe(text)
        }
      }
    }
  }
})

function pitched(raw: string): Chord {
  const reading = readChord(raw)
  if (!reading.ok) throw new Error(`expected a chord: ${raw}`)
  return reading.chord
}

function quality(raw: string): string {
  const chord = pitched(raw)
  if (chord.kind !== 'pitched') throw new Error(raw)
  return chord.quality
}

function written(raw: string): string {
  return writeChord(pitched(raw))
}

function normalised(raw: string): string {
  return writeChord(pitched(raw), { normalize: true })
}

function moved(raw: string, from: KeyName, to: KeyName): string {
  return writeChord(transposeChord(pitched(raw), from, to))
}
