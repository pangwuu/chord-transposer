import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatKey, formatSymbol } from './chord'
import { importChartPaste } from './chart-paste'
import { importText } from './import-text'
import { idSequence } from './song'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/chart-paste')

describe('importChartPaste', () => {
  it('passes clean ChordPro through unchanged', () => {
    const source = '{title: Demo}\n{key: C}\n{start_of_verse: Verse 1}\n[C]Hello [G]there\n'
    const viaPaste = importChartPaste(source, idSequence('cho'))
    const viaText = importText(source, idSequence('cho'))
    expect(viaPaste.source).toBeUndefined()
    expect(viaPaste.notices ?? []).toEqual([])
    expect(viaPaste.format).toBe(viaText.format)
    expect(viaPaste.song.title).toBe(viaText.song.title)
    expect(viaPaste.song.originalKey).toEqual(viaText.song.originalKey)
    expect(viaPaste.chordCount).toBe(viaText.chordCount)
    expect(viaPaste.sectionCount).toBe(viaText.sectionCount)
    expect(lyricSymbols(viaPaste.song)).toEqual(lyricSymbols(viaText.song))
  })

  it('passes clean chords-over-lyrics through unchanged', () => {
    const source = 'Verse 1\nD        G\nMorning on the kitchen table\n'
    const viaPaste = importChartPaste(source, idSequence('col'))
    const viaText = importText(source, idSequence('col'))
    expect(viaPaste.source).toBeUndefined()
    expect(viaPaste.format).toBe('chords-over-lyrics')
    expect(viaPaste.chordCount).toBe(viaText.chordCount)
    expect(lyricSymbols(viaPaste.song)).toEqual(lyricSymbols(viaText.song))
  })

  it('strips Ultimate Guitar page chrome and applies metadata', () => {
    const raw = readFileSync(join(fixtureDir, 'ug-chords-page.txt'), 'utf8')
    const result = importChartPaste(raw, idSequence('ug'))
    expect(result.source).toBe('ultimate-guitar')
    expect(result.song.title).toBe('Morning Kitchen')
    expect(result.song.artist).toBe('First Light Band')
    expect(formatKey(result.song.originalKey)).toBe('A')
    expect(result.song.views).toEqual([
      expect.objectContaining({ name: 'Capo 2', capo: 2 }),
    ])
    expect(result.song.sections.map((section) => section.label)).toEqual(['Verse 1', 'Chorus'])
    expect(result.chordCount).toBe(8)
    const verse = result.song.sections[0].lines[0]
    expect(verse.type).toBe('lyric')
    if (verse.type !== 'lyric') return
    expect(verse.text).toBe('Morning on the kitchen table')
    expect(verse.chords.map((chord) => formatSymbol(chord.symbol))).toEqual(['A', 'E'])
  })

  it('unwraps Ultimate Guitar [ch] markup into a chord chart', () => {
    const raw = readFileSync(join(fixtureDir, 'ug-with-ch-markup.txt'), 'utf8')
    const result = importChartPaste(raw, idSequence('ugch'))
    expect(result.source).toBe('ultimate-guitar')
    expect(result.song.title).toBe('Quiet Cup')
    expect(result.song.artist).toBe('First Light Band')
    expect(result.song.sections.map((section) => section.label)).toEqual(['Verse 1'])
    const line = result.song.sections[0].lines[0]
    expect(line.type).toBe('lyric')
    if (line.type !== 'lyric') return
    expect(line.text).toBe('Morning on the kitchen table')
    expect(line.chords.map((chord) => formatSymbol(chord.symbol))).toEqual(['C', 'G'])
  })

  it('notices ASCII tab pastes instead of inventing chords', () => {
    const raw = readFileSync(join(fixtureDir, 'ug-tab-page.txt'), 'utf8')
    const result = importChartPaste(raw, idSequence('ugtab'))
    expect(result.source).toBe('ultimate-guitar')
    expect(result.notices).toContain('Looks like a tab; paste the Chords version')
    expect(result.chordCount).toBe(0)
  })

  it('imports Ultimate Guitar app share without inventing a title', () => {
    const raw = readFileSync(join(fixtureDir, 'ug-app-share.txt'), 'utf8')
    const result = importChartPaste(raw, idSequence('ugapp'))
    expect(result.source).toBe('ultimate-guitar')
    expect(result.song.title).toBe('Untitled song')
    expect(result.song.views).toEqual([expect.objectContaining({ name: 'Capo 3', capo: 3 })])
    expect(result.song.sections[0].label).toBe('Verse 1')
    expect(result.chordCount).toBe(4)
  })

  it('strips Chordie page chrome and imports the ChordPro body', () => {
    const raw = readFileSync(join(fixtureDir, 'chordie-page.txt'), 'utf8')
    const result = importChartPaste(raw, idSequence('chordie'))
    expect(result.source).toBe('chordie')
    expect(result.song.title).toBe('Quiet Cup')
    expect(result.song.artist).toBe('First Light Band')
    expect(formatKey(result.song.originalKey)).toBe('C')
    expect(result.format).toBe('chordpro')
    expect(result.song.sections.map((section) => section.label)).toEqual(['Verse 1'])
    const line = result.song.sections[0].lines[0]
    expect(line.type).toBe('lyric')
    if (line.type !== 'lyric') return
    expect(line.text).toBe('Morning on the kitchen table')
    expect(line.chords.map((chord) => formatSymbol(chord.symbol))).toEqual(['C', 'G'])
  })

  it('strips E-Chords page chrome and applies metadata', () => {
    const raw = readFileSync(join(fixtureDir, 'echords-page.txt'), 'utf8')
    const result = importChartPaste(raw, idSequence('echords'))
    expect(result.source).toBe('e-chords')
    expect(result.song.title).toBe('Morning Kitchen')
    expect(result.song.artist).toBe('First Light Band')
    expect(formatKey(result.song.originalKey)).toBe('Ab')
    expect(result.song.views).toEqual([expect.objectContaining({ name: 'Capo 1', capo: 1 })])
    expect(result.song.sections.map((section) => section.label)).toEqual(['Verse 1', 'Chorus'])
    expect(result.chordCount).toBe(8)
    const verse = result.song.sections[0].lines[0]
    expect(verse.type).toBe('lyric')
    if (verse.type !== 'lyric') return
    expect(verse.text).toBe('Morning on the kitchen table')
    expect(verse.chords.map((chord) => formatSymbol(chord.symbol))).toEqual(['Ab', 'Eb'])
  })
})

function lyricSymbols(song: { sections: { lines: { type: string; text?: string; chords?: { index: number; symbol: Parameters<typeof formatSymbol>[0] }[] }[] }[] }) {
  const out: [string, number][] = []
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type !== 'lyric' || !line.chords) continue
      for (const chord of line.chords) out.push([formatSymbol(chord.symbol), chord.index])
    }
  }
  return out
}
