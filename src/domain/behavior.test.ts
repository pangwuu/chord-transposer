import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { formatSymbol, parseChord, parseKey } from './chord'
import { applyRestore, planRestore } from './backup'
import { addAt, addSectionOf, changeLyric, checkLine, deleteSectionOf, duplicateSectionOf, moveSectionOf, nudge, openEditor, removeSelected, renameSectionOf, saveConcertAsSongKey, setChordText, setSongDetails, stepConcert, undo, viewSong, chooseCapo } from './editor'
import { amazingGrace, firstLight } from '../fixtures/charts'
import { importText } from './import-text'
import { padCollisions } from './line-layout'
import { memoryLibrary } from './memory-library'
import { formatLyric, fromChordPro, toChordPro } from './chordpro'
import { layoutPdf } from './pdf-layout'
import { renderPdf } from './pdf-render'
import { decodeShare, encodeShare } from './share'
import { emptySong, idSequence, type Song } from './song'

const ids = idSequence('test')

describe('chordpro', () => {
  it('keeps bracket chords on the characters they were written on', () => {
    const song = fromChordPro('{title: First Light}\n{key: G}\n{start_of_verse: Verse 1}\n[G]Morning on the [D]kitchen [Em]table\n{end_of_verse}', ids)
    const line = song.sections[0].lines[0]
    expect(line.type).toBe('lyric')
    if (line.type !== 'lyric') return
    expect(line.text).toBe('Morning on the kitchen table')
    expect(line.chords.map((chord) => [formatSymbol(chord.symbol), chord.index])).toEqual([
      ['G', 0],
      ['D', 15],
      ['Em', 23],
    ])
    expect(formatLyric(line)).toBe('[G]Morning on the [D]kitchen [Em]table')
  })

  it('round-trips an original chart and a public-domain hymn', () => {
    for (const song of [firstLight, amazingGrace]) {
      const again = fromChordPro(toChordPro(song), idSequence('round'))
      expect(again.title).toBe(song.title)
      expect(again.originalKey).toEqual(song.originalKey)
      expect(textOf(again)).toBe(textOf(song))
      expect(symbolsOf(again)).toEqual(symbolsOf(song))
    }
  })
})

describe('plain import', () => {
  it('joins single chord lines into one lyric line', () => {
    const result = importText('Verse 1\nG\nMorning on the\nD\nkitchen table\n', idSequence('plain'))
    expect(result.format).toBe('inline')
    const line = result.song.sections[0].lines[0]
    expect(line.type).toBe('lyric')
    if (line.type !== 'lyric') return
    expect(line.text).toBe('Morning on the kitchen table')
    expect(line.chords.map((chord) => [formatSymbol(chord.symbol), chord.index])).toEqual([
      ['G', 0],
      ['D', 15],
    ])
  })

  it('maps a chord line onto the lyric columns beneath it', () => {
    const result = importText('D        G\nMorning on the kitchen table\n', idSequence('cols'))
    expect(result.format).toBe('chords-over-lyrics')
    const line = result.song.sections[0].lines[0]
    expect(line.type).toBe('lyric')
    if (line.type !== 'lyric') return
    expect(line.chords.map((chord) => chord.index)).toEqual([0, 9])
  })

  it('keeps an unrecognised token and reports it', () => {
    const result = importText('{title: Demo}\n{key: C}\n[C]Hello [H7]there\n', idSequence('bad'))
    expect(result.issues.map((issue) => issue.raw)).toContain('H7')
    const line = result.song.sections[0].lines[0]
    expect(line.type).toBe('lyric')
    if (line.type !== 'lyric') return
    expect(line.chords[1].symbol).toEqual({ kind: 'invalid', raw: 'H7' })
  })
})

describe('fixtures stay publishable', () => {
  it('does not contain the modern charts that were pasted in chat', () => {
    const packed = JSON.stringify([amazingGrace, firstLight]).toLowerCase()
    for (const phrase of ['my chains are gone', 'in christ alone', 'yet not i', 'this i believe', 'you are forever mine']) {
      expect(packed).not.toContain(phrase)
    }
    expect(amazingGrace.artist).toBe('John Newton')
  })
})

describe('editing', () => {
  it('nudges by a letter and a word, then undo restores the exact index', () => {
    const song = fromChordPro('{title: Demo}\n{key: C}\n[C]Morning on the table\n', idSequence('edit'))
    const id = lyric(song).chords[0].id
    let state = openEditor(song)
    state = { ...state, selectedIds: [id] }
    state = nudge(state, 'right')
    expect(lyric(state.song).chords[0].index).toBe(1)
    state = nudge(state, 'word-right')
    expect(lyric(state.song).chords[0].index).toBe(8)
    state = undo(state)
    expect(lyric(state.song).chords[0].index).toBe(1)
    state = undo(state)
    expect(lyric(state.song).chords[0].index).toBe(0)
  })

  it('keeps a transposed view off the stored song until save as song key', () => {
    const song = fromChordPro('{title: Demo}\n{key: F}\n[F/A]Hello\n', idSequence('view'))
    let state = openEditor(song)
    state = { ...state, concert: parseKey('E') }
    expect(formatSymbol(lyric(state.song).chords[0].symbol)).toBe('F/A')
    expect(formatSymbol(lyric(viewSong(state)).chords[0].symbol)).toBe('E/G#')
    state = saveConcertAsSongKey(state)
    expect(formatSymbol(lyric(state.song).chords[0].symbol)).toBe('E/G#')
    expect(state.song.originalKey).toEqual(parseKey('E'))
  })

  it('writes a capo-shape edit back into the stored key', () => {
    const song = fromChordPro('{title: Demo}\n{key: B}\n[F#sus]Hello\n', idSequence('capo'))
    let state = chooseCapo(openEditor(song), 4)
    expect(formatSymbol(lyric(viewSong(state)).chords[0].symbol)).toBe('Dsus')
    state = setChordText(state, lyric(state.song).chords[0].id, 'D')
    expect(formatSymbol(lyric(state.song).chords[0].symbol)).toBe('F#')
  })

  it('moves a chord onto the nearest surviving word and flags the line', () => {
    const song = fromChordPro('{title: Demo}\n{key: G}\nAmazing [G]grace\n', idSequence('words'))
    const lineId = lyric(song).id
    let state = changeLyric(openEditor(song), lineId, 'Amazing sound')
    const line = lyric(state.song)
    expect(line.needsCheck).toBe(true)
    expect(line.text.slice(line.chords[0].index)).toBe('sound')
    state = checkLine(state, lineId)
    expect(lyric(state.song).needsCheck).toBe(false)
  })

  it('renames, reorders, and restores a section', () => {
    const song = fromChordPro('{title: Demo}\n{key: C}\n{start_of_verse: Verse 1}\nHello\n{end_of_verse}', idSequence('section'))
    const original = song.sections[0].id
    let state = renameSectionOf(openEditor(song), original, 'Chorus')
    expect(state.song.sections[0].label).toBe('Chorus')
    expect(state.song.sections[0].kind).toBe('chorus')
    state = addSectionOf(state, 'bridge', 'Bridge')
    expect(state.song.sections.map((section) => section.label)).toEqual(['Chorus', 'Bridge'])
    state = moveSectionOf(state, original, 1)
    expect(state.song.sections.map((section) => section.id)[1]).toBe(original)
    state = duplicateSectionOf(state, state.song.sections[0].id)
    expect(state.song.sections[1].label).toBe('Bridge copy')
    state = deleteSectionOf(state, state.song.sections[1].id)
    expect(state.song.sections).toHaveLength(2)
    state = undo(state)
    expect(state.song.sections[1].label).toBe('Bridge copy')
  })

  it('edits the title, artist, tempo, and time, then undo restores them', () => {
    const song = fromChordPro('{title: Demo}\n{artist: Ada}\n{key: C}\n{tempo: 90}\n{time: 4/4}\nHello\n', idSequence('details'))
    let state = setSongDetails(openEditor(song), { title: 'Dawn', artist: 'Bea', tempo: 72, timeSignature: '6/8' })
    expect(state.song.title).toBe('Dawn')
    expect(state.song.artist).toBe('Bea')
    expect(state.song.tempo).toBe(72)
    expect(state.song.timeSignature).toBe('6/8')
    state = undo(state)
    expect(state.song.title).toBe('Demo')
    expect(state.song.artist).toBe('Ada')
    expect(state.song.tempo).toBe(90)
    expect(state.song.timeSignature).toBe('4/4')
  })

  it('adds, deletes, and restores a chord', () => {
    const song = fromChordPro('{title: Demo}\n{key: C}\nHello there\n', idSequence('add'))
    const lineId = lyric(song).id
    let state = addAt(openEditor(song), lineId, 6)
    expect(lyric(state.song).chords).toHaveLength(1)
    expect(formatSymbol(lyric(viewSong(state)).chords[0].symbol)).toBe('C')
    state = removeSelected(state)
    expect(lyric(state.song).chords).toHaveLength(0)
    state = undo(state)
    expect(lyric(state.song).chords[0].index).toBe(6)
  })
})

describe('line padding', () => {
  it('inserts hyphens inside a word instead of letting chord names collide', () => {
    const laid = padCollisions('ab', [
      { label: 'Cmaj7', index: 0 },
      { label: 'D', index: 1 },
    ])
    expect(laid.text).toBe('a-----b')
    expect(laid.chords.map((chord) => chord.index)).toEqual([0, 6])
  })
})

describe('pdf', () => {
  it('keeps a section that fits on one page together and numbers every page', () => {
    const song = longSong(36)
    const layout = layoutPdf(song, pdfOptions(song.originalKey))
    expect(layout.pages.length).toBeGreaterThan(1)
    const chorusPages = layout.pages.filter((page) => page.blocks.some((block) => block.kind === 'section' && block.label.startsWith('CHORUS')))
    expect(chorusPages).toHaveLength(1)
    expect(chorusPages[0].blocks.filter((block) => block.kind === 'section' && block.label.includes('CONT'))).toHaveLength(0)
    expect(layout.pages[0].runningHeader).toBeNull()
    expect(layout.pages[1].runningHeader).toContain('(cont.)')
    layout.pages.forEach((page, index) => {
      expect(page.pageLabel).toBe(`Page ${index + 1} of ${layout.pages.length}`)
    })
    expect(layout.pages.at(-1)?.cue).toBe('End of song')
    expect(JSON.stringify(layout)).not.toContain('needsCheck')
  })

  it('draws a black-and-white file with one page per laid-out page', async () => {
    const fonts = {
      sans: readFileSync('public/fonts/Inter-Regular.ttf'),
      sansBold: readFileSync('public/fonts/Inter-Bold.ttf'),
      sansItalic: readFileSync('public/fonts/Inter-Italic.ttf'),
      mono: readFileSync('public/fonts/JetBrainsMono-Regular.ttf'),
      monoBold: readFileSync('public/fonts/JetBrainsMono-ExtraBold.ttf'),
    }
    const layout = layoutPdf(firstLight, { ...pdfOptions(firstLight.originalKey), capo: 4, concert: parseKey('B') })
    expect(layout.pages[0].capoLabel).toBe('CAPO 4 · PLAY G SHAPES')
    expect(layout.fileName).toBe('First Light - B - Capo 4.pdf')
    const bytes = await renderPdf(layout, fonts)
    const document = await PDFDocument.load(bytes)
    expect(document.getPageCount()).toBe(layout.pages.length)
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('%PDF')
  })
})

describe('share and library', () => {
  it('round-trips a song through a share hash and refuses an oversized one', () => {
    const encoded = encodeShare(firstLight)
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    expect(decodeShare(encoded.hash).title).toBe('First Light')
    expect(encodeShare(firstLight, 8)).toEqual({ ok: false, reason: 'too-large' })
  })

  it('starts empty and offers replace or keep when a backup id already exists', async () => {
    const library = memoryLibrary()
    expect((await library.load()).songs).toEqual([])
    await library.saveSong(firstLight)
    expect((await library.load()).songs.map((song) => song.id)).toEqual([firstLight.id])
    const plan = planRestore([firstLight], [firstLight, amazingGrace])
    expect(plan.conflicts).toEqual([firstLight.id])
    const replaced = applyRestore([firstLight], [{ ...amazingGrace, id: firstLight.id, title: 'Replacement' }], { [firstLight.id]: 'replace' })
    expect(replaced.map((song) => song.title)).toEqual(['Replacement'])
    const both = applyRestore([firstLight], [{ ...amazingGrace, id: firstLight.id }], { [firstLight.id]: 'keep' })
    expect(both).toHaveLength(2)
  })
})

function lyric(song: Song) {
  const line = song.sections.flatMap((section) => section.lines).find((line) => line.type === 'lyric')
  if (!line || line.type !== 'lyric') throw new Error('missing lyric')
  return line
}

function textOf(song: Song): string {
  return song.sections.flatMap((section) => section.lines).map((line) => (line.type === 'lyric' ? line.text : line.type === 'comment' ? line.text : 'bars')).join('\n')
}

function symbolsOf(song: Song): string[] {
  return song.sections.flatMap((section) =>
    section.lines.flatMap((line) => {
      if (line.type === 'lyric') return line.chords.map((chord) => `${formatSymbol(chord.symbol)}@${chord.index}`)
      if (line.type === 'bars') return line.items.map((item) => (item.kind === 'chord' ? formatSymbol(item.symbol) : item.kind))
      return []
    }),
  )
}

function longSong(lines: number): Song {
  const song = emptySong({ title: 'Pager', originalKey: parseKey('C') }, idSequence('long'))
  song.sections[0].lines = Array.from({ length: lines }, (_, index) => ({
    id: `line-${index}`,
    type: 'lyric' as const,
    text: `Line number ${index} stays whole`,
    chords: [],
    needsCheck: false,
  }))
  song.sections.push({
    id: 'chorus',
    kind: 'chorus',
    label: 'Chorus',
    lines: [{ id: 'chorus-line', type: 'lyric', text: 'Short chorus line', chords: [], needsCheck: false }],
  })
  song.arrangement = [{ sectionId: song.sections[0].id }, { sectionId: 'chorus' }]
  return song
}

function pdfOptions(concert: Song['originalKey']) {
  return {
    paper: 'a4' as const,
    fontSize: 12,
    columns: 1 as const,
    fit: 'auto' as const,
    content: 'full' as const,
    numbers: false,
    capo: 0,
    concert,
    repeats: 'full' as const,
    allowTwoColumns: false,
  }
}

void stepConcert
void parseChord
