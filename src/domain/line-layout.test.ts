import { describe, expect, it } from 'vitest'
import { padCollisions, wrapLyricDisplay } from './line-layout'

describe('wrapLyricDisplay', () => {
  it('returns the line unchanged when it fits', () => {
    expect(
      wrapLyricDisplay('Morning light', [{ label: 'G', index: 0 }], 20),
    ).toEqual([{ text: 'Morning light', chords: [{ label: 'G', index: 0 }] }])
  })

  it('wraps on spaces and hanging-indents continuations by 2ch', () => {
    const text = 'Sometimes you are no longer together'
    const segments = wrapLyricDisplay(
      text,
      [
        { label: 'D', index: 0 },
        { label: 'G', index: 22 },
      ],
      20,
    )
    expect(segments.map((segment) => segment.text)).toEqual([
      'Sometimes you are no',
      '  longer together',
    ])
    expect(segments[0].chords).toEqual([{ label: 'D', index: 0 }])
    expect(segments[1].chords).toEqual([{ label: 'G', index: 3 }])
  })

  it('hard-cuts when a word is longer than capacity', () => {
    const segments = wrapLyricDisplay(
      'Supercalifragilistic',
      [{ label: 'C', index: 0 }],
      10,
    )
    expect(segments.map((segment) => segment.text)).toEqual([
      'Supercalif',
      '  ragilist',
      '  ic',
    ])
    expect(segments[0].chords).toEqual([{ label: 'C', index: 0 }])
  })

  it('skips wrapping when capacity is below 8', () => {
    const text = 'A long lyric line that would wrap'
    expect(wrapLyricDisplay(text, [{ label: 'A', index: 0 }], 7)).toEqual([
      { text, chords: [{ label: 'A', index: 0 }] },
    ])
  })

  it('keeps padCollisions then wrap aligned', () => {
    const laid = padCollisions('ab', [
      { label: 'Cmaj7', index: 0 },
      { label: 'D', index: 1 },
    ])
    const segments = wrapLyricDisplay(laid.text, laid.chords, 20)
    expect(segments).toHaveLength(1)
    expect(segments[0].text).toBe('a-----b')
    expect(segments[0].chords.map((chord) => [chord.label, chord.index])).toEqual([
      ['Cmaj7', 0],
      ['D', 6],
    ])
  })
})
