import { describe, expect, it } from 'vitest'
import {
  QUALITIES,
  easyChord,
  formatSymbol,
  keyFromPitch,
  nashville,
  parseChord,
  parseKey,
  prefsForBias,
  transposeSymbol,
  type AccidentalBias,
} from './chord'
import { toChordPro } from './chordpro'
import { openEditor, setChordText, undo } from './editor'
import { layoutPdf } from './pdf-layout'
import { displayedSong, mapSymbols } from './song'
import { amazingGrace, firstLight } from '../fixtures/charts'

const easy = (text: string) => formatSymbol(easyChord(parseChord(text)))

/** Written by hand from the issue's table, not derived from the code. */
const EXPECTED: Record<string, '' | 'm' | 'dim' | 'aug'> = {
  '': '', maj: '', M: '', maj7: '', M7: '', 'Δ': '', 'Δ7': '', '7': '', '9': '', '11': '', '13': '', maj9: '', '6': '',
  add9: '', add2: '', add4: '', add11: '', '2': '', '4': '', '5': '', sus: '', sus2: '', sus4: '', '7sus4': '',
  '7sus': '', '7sus2': '', '9sus4': '', '7b5': '', '7b9': '', '7#9': '', maj13: '', 'maj7#11': '',
  m: 'm', min: 'm', m7: 'm', min7: 'm', m6: 'm', m9: 'm', m11: 'm', madd9: 'm', m13: 'm', madd11: 'm', mM7: 'm', mmaj7: 'm',
  dim: 'dim', '°': 'dim', dim7: 'dim', '°7': 'dim', m7b5: 'dim', 'ø': 'dim', 'ø7': 'dim',
  aug: 'aug', '+': 'aug', aug7: 'aug', '+7': 'aug', 'm7#5': 'aug', '7#5': 'aug',
}

describe('easy chords', () => {
  it('has a hand-checked easy form for every quality the parser accepts', () => {
    for (const quality of QUALITIES) {
      expect(EXPECTED, `quality "${quality}" needs an easy form`).toHaveProperty([quality])
      expect(easy(`C${quality}`), `C${quality}`).toBe(`C${EXPECTED[quality]}`)
    }
  })

  it('drops the bass of a slash chord and keeps the root', () => {
    expect(easy('G/B')).toBe('G')
    expect(easy('D/F#')).toBe('D')
    expect(easy('Am7/G')).toBe('Am')
  })

  it('never changes the root, however it is spelled', () => {
    expect(easy('C##m7')).toBe('C##m')
    expect(easy('Dbbmaj7')).toBe('Dbb')
    expect(easy('F#sus4')).toBe('F#')
    expect(easy('Bbadd9')).toBe('Bb')
  })

  it('leaves N.C. and unrecognised chords exactly as written', () => {
    expect(easyChord(parseChord('N.C.'))).toEqual(parseChord('N.C.'))
    const odd = parseChord('Gwhat')
    expect(odd.kind).toBe('invalid')
    expect(easyChord(odd)).toBe(odd)
    expect(easy('H7')).toBe('H7')
  })

  it('plays an altered chord as the chord it alters', () => {
    expect(easy('Cm7b9')).toBe('Cm')
    expect(easy('C7#11')).toBe('C')
  })

  const roots = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C##', 'Dbb']
  const basses = ['', '/E', '/Bb', '/F#']
  const chords = roots.flatMap((root) => [...QUALITIES].flatMap((quality) => basses.map((bass) => parseChord(`${root}${quality}${bass}`))))

  it('gives the same text whether simplified before or after transposing, in all 12 keys', () => {
    for (const bias of ['default', 'flats', 'sharps'] as AccidentalBias[]) {
      const prefs = prefsForBias(bias)
      for (let pitch = 0; pitch < 12; pitch += 1) {
        const key = keyFromPitch(pitch, pitch % 2 ? 'minor' : 'major', prefs)
        for (const chord of chords) {
          const steps = (pitch + 5) % 12
          const before = formatSymbol(transposeSymbol(easyChord(chord), steps, key, prefs))
          const after = formatSymbol(easyChord(transposeSymbol(chord, steps, key, prefs)))
          expect(before, `${formatSymbol(chord)} to ${pitch} (${bias})`).toBe(after)
        }
      }
    }
  })

  it('changes nothing when applied twice, and always lands on a plain chord with no bass', () => {
    for (const chord of chords) {
      const once = easyChord(chord)
      expect(easyChord(once)).toEqual(once)
      if (once.kind !== 'chord') throw new Error('expected a chord')
      expect(['', 'm', 'dim', 'aug']).toContain(once.chord.quality)
      expect(once.chord.bass).toBeUndefined()
    }
  })

  it('works with Nashville numbers', () => {
    const key = parseKey('G')
    const numbers = ['Gmaj7', 'Cadd9', 'Dsus4', 'Em7', 'G/B'].map((text) => nashville(easyChord(parseChord(text)), key))
    expect(numbers).toEqual(['1', '4', '5', '6m', '1'])
  })

  it('works with capo shapes and each accidental choice', () => {
    const shown = (bias: AccidentalBias) => {
      const prefs = prefsForBias(bias)
      // Amazing Grace in Bb with capo 3 is played with G shapes.
      const view = mapSymbols(displayedSong(amazingGrace, keyFromPitch(10, 'major', prefs), 3, prefs), easyChord)
      const first = view.sections[0].lines[0]
      return first.type === 'lyric' ? first.chords.map((chord) => formatSymbol(chord.symbol)) : []
    }
    expect(shown('default')).toEqual(['G', 'G', 'C', 'G'])
    const flat = mapSymbols(displayedSong(amazingGrace, parseKey('Ab'), 0, prefsForBias('flats')), easyChord)
    const sharp = mapSymbols(displayedSong(amazingGrace, parseKey('Ab'), 0, prefsForBias('sharps')), easyChord)
    const line = (song: typeof flat) => { const item = song.sections[0].lines[0]; return item.type === 'lyric' ? item.chords.map((chord) => formatSymbol(chord.symbol)) : [] }
    expect(line(flat)).toEqual(['Ab', 'Ab', 'Db', 'Ab'])
    expect(line(sharp)).toEqual(['G#', 'G#', 'C#', 'G#'])
  })

  it('leaves the stored song untouched by viewing, PDF export and ChordPro export', () => {
    for (const song of [amazingGrace, firstLight]) {
      const before = structuredClone(song)
      mapSymbols(displayedSong(song, parseKey('A'), 2), easyChord)
      layoutPdf(song, { paper: 'a4', fontSize: 12, columns: 1, fit: 'auto', content: 'full', numbers: false, capo: 0, concert: song.originalKey, repeats: 'full', allowTwoColumns: true, easyChords: true })
      toChordPro(song)
      expect(song).toEqual(before)
    }
  })

  it('prints simplified chords in the PDF at the same places over the lyrics', () => {
    const options = { paper: 'a4', fontSize: 12, columns: 1, fit: 'auto', content: 'full', numbers: false, capo: 0, concert: amazingGrace.originalKey, repeats: 'full', allowTwoColumns: true } as const
    const lyric = (easyChords: boolean) => {
      const block = layoutPdf(amazingGrace, { ...options, easyChords }).pages[0].blocks.find((item) => item.kind === 'lyric')
      if (!block || block.kind !== 'lyric') throw new Error('no lyric line')
      return block
    }
    expect(lyric(false).chords.map((chord) => chord.label)).toEqual(['G', 'G7', 'C', 'G'])
    expect(lyric(true).chords.map((chord) => chord.label)).toEqual(['G', 'G', 'C', 'G'])
    expect(lyric(true).chords.map((chord) => chord.index)).toEqual(lyric(false).chords.map((chord) => chord.index))
    expect(lyric(true).text).toBe(lyric(false).text)
  })

  it('an edit made while easy chords are shown, then undone, leaves the song identical', () => {
    const opened = openEditor(amazingGrace)
    const line = amazingGrace.sections[0].lines[0]
    if (line.type !== 'lyric') throw new Error('expected a lyric line')
    const seventh = line.chords[1]
    expect(formatSymbol(seventh.symbol)).toBe('G7')
    // The editor is given what the player typed, never the simplified chord on screen.
    const edited = setChordText(opened, seventh.id, 'D7')
    expect(undo(edited).song).toBe(amazingGrace)
    expect(undo(edited).song).toEqual(structuredClone(amazingGrace))
  })
})
