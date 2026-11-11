import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatKey, formatSymbol } from './chord'
import { formatBarLine, formatLyric, fromChordPro, toChordPro } from './chordpro'
import { importChartPaste } from './chart-paste'
import { idSequence, performance, type Song } from './song'

const fixture = (name: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/chart-paste', name), 'utf8')
const paste = (raw: string) => importChartPaste(raw, idSequence('shape'))

function chart(song: Song): string[] {
  return song.sections.flatMap((section) => [
    `# ${section.label}`,
    ...section.lines.map((line) => (line.type === 'lyric' ? formatLyric(line) : line.type === 'bars' ? formatBarLine(line) : `(${line.text})`)),
  ])
}

const order = (song: Song) => performance(song).map((played) => played.section.label)

const REFRAIN = [
  '# Refrain',
  'A[G]mazing [G7]Grace, how [C]sweet the [G]sound',
  'That saved a [A]wretch like [D]me!',
  'I [G]once was [G7]lost, but [C]now am [G]found,',
  'Was [Em]blind, but [D]now I [G]see.',
]

const UG_CHART = [
  ...REFRAIN,
  '# Verse 1',
  "'Twas [G]grace that [G7]taught my [C]heart to [G]fear,",
  'And grace my [A]fears re[D]lieved.',
  'How [G]precious [G7]did that [C]grace a[G]ppear,',
  'The [Em]hour I [D]first be[G]lieved.',
  '# Verse 2',
  'Throug[G]h many [G7]dangers, [C]toils and s[G]nares',
  'We have alr[A]eady [D]come',
]

describe('real pages', () => {
  it.each(['ug-desktop-amazing-grace.txt', 'ug-phone-amazing-grace.txt'])('reads the Ultimate Guitar page %s', (name) => {
    const result = paste(fixture(name))
    expect(result.source).toBe('ultimate-guitar')
    expect(result.notices).toEqual([])
    expect(result.song.title).toBe('Amazing Grace')
    expect(result.song.artist).toBe('Misc Praise Songs/John Newton')
    expect(formatKey(result.song.originalKey)).toBe('G')
    expect(result.keyGuessed).toBe(false)
    expect(result.song.views).toEqual([])
    expect(result.issues).toEqual([])
    expect(chart(result.song).slice(0, UG_CHART.length)).toEqual(UG_CHART)
    expect(order(result.song)).toEqual(['Refrain', 'Verse 1', 'Verse 2', 'Refrain'])
    expect(chart(result.song).join('\n')).not.toMatch(/Sign up|Please rate|All artists|VERSIONS|e\|---/)
  })

  it('joins a line the phone wrapped, whichever row the words broke on', () => {
    const phone = paste(fixture('ug-phone-amazing-grace.txt'))
    expect(chart(phone.song)).toContain("'Twas g[G]race hath [G7]brought us [C]safe thus f[G]ar")
  })

  it('reads the E-Chords page on desktop', () => {
    const result = paste(fixture('echords-desktop-amazing-grace.txt'))
    expect(result.source).toBe('e-chords')
    expect(result.song.title).toBe('Amazing Grace')
    expect(result.song.artist).toBe('Hymn')
    expect(formatKey(result.song.originalKey)).toBe('Am')
    expect(chart(result.song).slice(0, 4)).toEqual(['# Intro', '| Am | C | D | F |', '# Verse 1', 'A[Am]mazing Grac[C]e, how[D] sweet the [F]sound'])
    expect(chart(result.song).join('\n')).toContain('# Verse 2')
    expect(chart(result.song).join('\n')).not.toMatch(/1\. |2\. |Share|Sent by|cookies/)
    expect(result.song.arrangement[0].repeat).toBe(2)
  })

  it('reads the E-Chords page on a phone, including a line it wrapped without a trailing space', () => {
    const result = paste(fixture('echords-phone-amazing-grace.txt'))
    expect(result.song.title).toBe('Amazing Grace')
    const lines = chart(result.song)
    const wrapped = lines.find((line) => line.includes('heart'))
    expect(wrapped?.replace(/\[[^\]]+\]/g, '')).toBe("T'was Grace that taught my heart to fear.")
    expect(wrapped).toContain('t[F]o fear.')
  })

  it('rebuilds Chordie text where each chord splits its words onto new lines', () => {
    const result = paste(fixture('chordie-interleaved-amazing-grace.txt'))
    expect(result.source).toBe('chordie')
    expect(result.format).toBe('inline')
    expect(result.song.title).toBe('Amazing Grace')
    expect(result.song.artist).toBe('John Newton')
    expect(chart(result.song)).toEqual([
      '# Intro',
      '| G | C | G |',
      '# Verse 1',
      '[G]Amazing gr[C]ace how sweet the sou[G]nd',
      '[G]That saved a [D]wretch like m[G]e',
      '# Verse 2',
      "[G]'Twas grace that [C]taught my heart to fe[G]ar",
      '[G]And grace my fe[D]ars reliev[G]ed',
      '# Outro',
      '| G | C | G |',
    ])
    expect(result.song.arrangement[0].repeat).toBe(2)
    expect(result.song.arrangement.at(-1)?.repeat).toBe(4)
  })

  it('cleans an unknown site without being told which one it is', () => {
    const result = paste(fixture('unknown-site-page.txt'))
    expect(result.source).toBeUndefined()
    expect(result.song.title).toBe('Quiet Morning')
    expect(result.song.artist).toBe('First Light Band')
    expect(result.song.sections.map((section) => section.label)).toEqual(['Verse 1', 'Chorus'])
    expect(chart(result.song).join('\n')).not.toMatch(/Comments|Download|Shop/)
  })
})

describe('paste shapes', () => {
  it('treats bracket headings over chord lines as chords-over-lyrics', () => {
    const result = paste('[Verse 1]\nG             D\nMorning on the kitchen table\n\n[Chorus]\nC         G\nHold on a little longer\n')
    expect(result.format).toBe('chords-over-lyrics')
    expect(result.issues).toEqual([])
    expect(chart(result.song)).toEqual(['# Verse 1', '[G]Morning on the[D] kitchen table', '# Chorus', '[C]Hold on a [G]little longer'])
  })

  it('reads bracket headings mixed with inline chords as sections', () => {
    const result = paste('[Verse 1]\n[G]Morning on the [D]kitchen table\n[Chorus]\n[C]Hold on a [G]little longer\n')
    expect(result.format).toBe('chordpro')
    expect(result.issues).toEqual([])
    expect(result.song.sections.map((section) => [section.label, section.kind])).toEqual([['Verse 1', 'verse'], ['Chorus', 'chorus']])
  })

  it('pairs chord lines across a blank line when the whole paste is double spaced', () => {
    const result = paste('Verse 1\n\nG             D\n\nMorning on the kitchen table\n\nEm            C\n\nCoffee going cold again\n')
    expect(chart(result.song)).toEqual(['# Verse 1', '[G]Morning on the[D] kitchen table', '[Em]Coffee going c[C]old again'])
  })

  it('does not pair a closing chord line with the next stanza in a normal paste', () => {
    const result = paste('G        D\nMorning light falls\nEm       C\nCoffee going cold\nG  D\n\nEvening on the ledge\n')
    expect(chart(result.song)).toContain('| G | D |')
    expect(chart(result.song)).toContain('Evening on the ledge')
  })

  it('keeps chord columns when tabs are used for spacing', () => {
    const result = paste('Verse 1\nG\t\tD\nMorning on the kitchen table\n')
    expect(chart(result.song)).toContain('[G]Morning on the k[D]itchen table')
  })

  it('reads Windows line endings, non-breaking spaces and Unicode accidentals', () => {
    const result = paste('Verse 1\r\nA♭      F♯m\r\nMorning on the table\r\n')
    expect(result.issues).toEqual([])
    expect(chart(result.song)).toEqual(['# Verse 1', '[Ab]Morning [F#m]on the table'])
  })

  it('measures chord columns from the lyric, not the margin', () => {
    const result = paste('Verse 1\n   G             D\n   Morning on the kitchen table\n        Em       C\n   Coffee going cold again\n')
    expect(chart(result.song)).toEqual(['# Verse 1', '[G]Morning on the[D] kitchen table', 'Coffe[Em]e going c[C]old again'])
  })

  it('reads a chord line carrying annotations, and keeps the annotation as a note', () => {
    const result = paste('Intro\nG  D/F#  Em7  Cadd9  (x2)\n\nVerse 1\nA7sus4    Bm7b5   C2   G*\nCoffee going cold again now\nBb(add9)  N.C.\nStill the morning comes\n')
    expect(result.issues).toEqual([])
    expect(chart(result.song)).toEqual([
      '# Intro',
      '| G | D/F# | Em7 | Cadd9 |',
      '(x2)',
      '# Verse 1',
      '[A7sus4]Coffee goi[Bm7b5]ng cold [C2]again[G] now',
      '[Bbadd9]Still the [N.C.]morning comes',
    ])
  })

  it('shows an unknown token on a mostly chord line instead of losing the line', () => {
    const result = paste('G  D  Em  Cfoo\nMorning on the kitchen table\n')
    expect(result.issues.map((issue) => issue.raw)).toEqual(['Cfoo'])
    expect(result.chordCount).toBe(4)
  })

  it('does not read ordinary words as chords', () => {
    const result = paste('Verse 1\nG        D\nMorning light\nA am I\n')
    expect(chart(result.song)).toContain('A am I')
  })

  it('keeps a lyric that starts with a section word', () => {
    const result = paste('Verse 1\nG             D\nChorus of angels singing loud\nEm            C\nBridge the gap between us now\nG        D\nEnding every night in peace\n')
    expect(result.song.sections.map((section) => section.label)).toEqual(['Verse 1'])
    expect(chart(result.song)).toContain('[Em]Bridge the gap[C] between us now')
  })

  it('reads the headings people actually write, and tidies them', () => {
    const result = paste('Refrain:\nG        D\nHold on a little longer\n\nSolo\nG D Em C\n\nTurnaround\nC G\n\nPost-Chorus\nG             D\nLight is coming through\n\nVERSE 2:\nG             D\nEvening on the window ledge\n')
    expect(result.song.sections.map((section) => [section.label, section.kind])).toEqual([
      ['Refrain', 'chorus'],
      ['Solo', 'instrumental'],
      ['Turnaround', 'instrumental'],
      ['Post-Chorus', 'custom'],
      ['Verse 2', 'verse'],
    ])
  })

  it('leaves no chord stacked when the chord line outruns its lyric', () => {
    const result = paste('Verse\nG     D     Em     C      G\nHold on\n')
    const line = result.song.sections[0].lines[0]
    if (line.type !== 'lyric') throw new Error('expected a lyric')
    expect(line.chords.map((chord) => [formatSymbol(chord.symbol), chord.index])).toEqual([['G', 0], ['D', 6], ['Em', 12], ['C', 19], ['G', 26]])
  })
})

describe('key', () => {
  it('guesses the key from every chord, not the first', () => {
    const result = paste('Verse\nC      G      D     Em\nMorning on the kitchen table\nC      G      D\nCoffee going cold again\n')
    expect(result.detectedKey).toBe('G')
    expect(result.keyGuessed).toBe(true)
  })

  it('guesses a minor key when the song lives there', () => {
    expect(paste('Am    C     G    Am\nMorning on the kitchen table\nF     G     Am\nCoffee going cold again\n').detectedKey).toBe('Am')
  })

  it('guesses for inline chords with no key directive', () => {
    const result = paste('[C]Morning [G]on the [D]kitchen [Em]table\n')
    expect(result.detectedKey).toBe('G')
    expect(result.keyGuessed).toBe(true)
  })

  it('trusts a stated key', () => {
    const result = paste('{title: Demo}\n{key: F}\n[C]Morning [G]light\n')
    expect(result.detectedKey).toBe('F')
    expect(result.keyGuessed).toBe(false)
  })
})

describe('capo', () => {
  const page = (key: string) => `Ultimate Guitar\nDemo Song\nby First Light Band\nKey: ${key}\nCapo: 2nd fret\n\nVerse 1\nG                D\nMorning on the kitchen table\nEm               C\nCoffee in a quiet cup\n`

  it('stores the sounding key and keeps a view of the shapes that were pasted', () => {
    const result = paste(page('G'))
    expect(formatKey(result.song.originalKey)).toBe('A')
    expect(chart(result.song)).toContain('[A]Morning on the ki[E]tchen table')
    expect(result.song.views).toEqual([expect.objectContaining({ name: 'Capo 2', capo: 2, key: result.song.originalKey })])
    expect(result.notices).toContain('Capo 2: sounds in A, shown as G shapes')
  })

  it('accepts a stated key that is already the sounding key', () => {
    const result = paste(page('A'))
    expect(formatKey(result.song.originalKey)).toBe('A')
    expect(chart(result.song)).toContain('[A]Morning on the ki[E]tchen table')
  })
})

describe('repeated sections', () => {
  const song = 'Verse 1\nG             D\nMorning on the kitchen table\n\nChorus\nC         G\nHold on a little longer\n\nVerse 2\nG             D\nEvening on the window ledge\n\nChorus\nC         G\nHold on a little longer\n\nChorus\n'

  it('folds a written-out chorus and a bare chorus into the arrangement', () => {
    const result = paste(song)
    expect(result.song.sections.map((section) => section.label)).toEqual(['Verse 1', 'Chorus', 'Verse 2'])
    expect(order(result.song)).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Chorus'])
    expect(result.song.arrangement.at(-1)?.repeat).toBe(2)
  })

  it('points Repeat Chorus at the earlier chorus', () => {
    const result = paste('Chorus\nC         G\nHold on a little longer\n\nRepeat Chorus x2\n')
    expect(result.song.sections).toHaveLength(1)
    expect(order(result.song)).toEqual(['Chorus', 'Chorus', 'Chorus'])
  })

  it('keeps sections that share a name but differ', () => {
    const result = paste('Chorus\nC         G\nHold on a little longer\n\nChorus\nD         A\nHold on a little longer\n')
    expect(result.song.sections).toHaveLength(2)
  })

  it('keeps a bare heading with nothing earlier to point to', () => {
    expect(paste('Instrumental\n\nVerse 1\nG        D\nMorning light\n').song.sections.map((section) => section.label)).toEqual(['Instrumental', 'Verse 1'])
  })
})

describe('arrangement in ChordPro', () => {
  const folded = () => paste('Verse 1\nG        D\nMorning light\n\nChorus\nC        G\nHold on\n\nVerse 2\nG        D\nEvening light\n\nChorus x2\nC        G\nHold on\n').song

  it('survives writing out and reading back', () => {
    const song = folded()
    const again = fromChordPro(toChordPro(song), idSequence('again'))
    expect(order(again)).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Chorus'])
    expect(again.sections).toHaveLength(3)
    expect(toChordPro(song)).toContain('{x_arrangement: 1 2 3 2x2}')
  })

  it('adds nothing when the song plays straight through', () => {
    expect(toChordPro(fromChordPro('{title: Demo}\n{key: G}\n{start_of_verse: Verse 1}\n[G]Hello\n{end_of_verse}\n', idSequence('plain')))).not.toContain('x_arrangement')
  })

  it('ignores an arrangement that names no real section', () => {
    const song = fromChordPro('{title: Demo}\n{key: G}\n{start_of_verse: Verse 1}\n[G]Hello\n{end_of_verse}\n{x_arrangement: 9 nonsense}\n', idSequence('bad'))
    expect(order(song)).toEqual(['Verse 1'])
  })
})

describe('chords at the same place', () => {
  it('keeps them in written order when written out', () => {
    const song = fromChordPro('{title: Demo}\n{key: G}\n{start_of_verse: Verse 1}\nHold on[Em][G][C]\n{end_of_verse}\n', () => crypto.randomUUID())
    expect(toChordPro(song)).toContain('Hold on[Em][G][C]')
  })
})

describe('review findings', () => {
  it('keeps the closing letters of a Chordie line at the very end of a page', () => {
    const page = 'Login/register\nHOME\nJohn Newton - Amazing Grace\nVerse\nG\nAmazing grace \nC\nhow sweet the sou\nG\nnd\n\nImportant: The song above is NOT stored on the Chordie server.\nVIEW\n'
    expect(chart(paste(page).song)).toContain('[G]Amazing grace [C]how sweet the sou[G]nd')
  })

  it.each(['[Chorus x2]', '[Chorus] x2', 'Chorus (x2)', '(Chorus x2)'])('reads %s as a heading with a repeat', (heading) => {
    const result = paste(`${heading}\nC         G\nHold on a little longer\n`)
    expect(result.song.sections.map((section) => section.label)).toEqual(['Chorus'])
    expect(order(result.song)).toEqual(['Chorus', 'Chorus'])
  })

  it('does not join separate lines because one has a stray trailing space', () => {
    const result = paste('G        D\nMorning light falls over the table \nEm      C\nCoffee going cold\nA       D\nThe day begins again\n')
    expect(chart(result.song)).toContain('[Em]Coffee g[C]oing cold')
  })

  it('keeps a one-word lyric that matches a site button', () => {
    const page = 'Ultimate Guitar\nDemo Song\nby Band\n\nVerse 1\nG        D\nMorning light falls\nC\nHome\nG        D\nEvening light falls\n'
    expect(chart(paste(page).song)).toContain('[C]Home')
  })

  it('leaves a chord list in the footer out of the chart', () => {
    const page = 'Ultimate Guitar\nDemo Song\nby Band\n\nVerse 1\nG        D\nMorning light falls\n\nThanks for visiting our page today\nMore songs from this artist below\nChords used\nAm C D F E7\n'
    expect(chart(paste(page).song)).toEqual(['# Verse 1', '[G]Morning l[D]ight falls'])
  })

  it('keeps a chord row at the top of a chart with no heading', () => {
    const page = 'Ultimate Guitar\nDemo Song\nby Band\n\nG  D  Em  C\n\nG        D\nMorning light falls\n'
    expect(chart(paste(page).song)[1]).toBe('| G | D | Em | C |')
  })

  it('keeps the column of an indented single chord', () => {
    const result = paste('      G\nMorning on the table\n      D\nCoffee going cold\n      C\nEvening on the ledge\n')
    expect(result.format).toBe('chords-over-lyrics')
    expect(chart(result.song)).toContain('Mornin[G]g on the table')
  })

  it('keeps identical sections apart when they have different names', () => {
    const result = paste('Solo\nG D Em C\n\nBreak\nG D Em C\n')
    expect(result.song.sections.map((section) => section.label)).toEqual(['Solo', 'Break'])
  })
})
