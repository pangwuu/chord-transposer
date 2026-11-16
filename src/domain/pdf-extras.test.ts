import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { parseKey, prefsForBias } from './chord'
import { fromChordPro } from './chordpro'
import { layoutCover, layoutPdf, layoutSetlist, type PdfOptions, type SetlistChart } from './pdf-layout'
import { renderCover, renderPdf } from './pdf-render'
import { emptySong } from './song'
import { amazingGrace, firstLight } from '../fixtures/charts'

const options = (extra: Partial<PdfOptions> = {}): PdfOptions => ({
  paper: 'a4', fontSize: 12, columns: 1, fit: 'auto', content: 'full', numbers: false, capo: 0, concert: amazingGrace.originalKey, repeats: 'full', allowTwoColumns: false, ...extra,
})

const fonts = () => ({
  sans: readFileSync('public/fonts/Inter-Regular.ttf'),
  sansBold: readFileSync('public/fonts/Inter-Bold.ttf'),
  sansItalic: readFileSync('public/fonts/Inter-Italic.ttf'),
  mono: readFileSync('public/fonts/JetBrainsMono-Regular.ttf'),
  monoBold: readFileSync('public/fonts/JetBrainsMono-ExtraBold.ttf'),
})

describe('chords used on the PDF', () => {
  it('is off unless asked for, and leaves the layout exactly as it was', () => {
    const plain = layoutPdf(amazingGrace, options())
    expect(plain.pages.every((page) => page.chordsUsed === null)).toBe(true)
    expect(layoutPdf(amazingGrace, options({ showChords: false }))).toEqual(plain)
  })

  it('lists the distinct chords on the first page only', () => {
    const laid = layoutPdf(firstLight, options({ concert: firstLight.originalKey, showChords: true, fit: 'auto' }))
    const [first, ...rest] = laid.pages
    expect(first.chordsUsed?.flat().map((chord) => chord.label)).toEqual(layoutChordLabels(firstLight))
    expect(rest.every((page) => page.chordsUsed === null)).toBe(true)
  })

  it('follows numbers, capo shapes and easy chords', () => {
    const strip = (extra: Partial<PdfOptions>) => layoutPdf(amazingGrace, options({ showChords: true, ...extra })).pages[0].chordsUsed?.flat().map((chord) => chord.label)
    expect(strip({})).toEqual(['G', 'G7', 'C', 'Em', 'A7', 'D', 'D7'])
    expect(strip({ numbers: true })).toEqual(['1', '17', '4', '6m', '27', '5', '57'])
    expect(strip({ concert: parseKey('Bb'), capo: 3 })).toEqual(['G', 'G7', 'C', 'Em', 'A7', 'D', 'D7'])
    expect(strip({ easyChords: true })).toEqual(['G', 'C', 'Em', 'A', 'D'])
    expect(strip({ content: 'lyrics' })).toBeUndefined()
  })

  it('moves no chord over its lyric and breaks no section that fitted before', () => {
    const lyricBlocks = (showChords: boolean) => layoutPdf(amazingGrace, options({ showChords })).pages.flatMap((page) => page.blocks.filter((block) => block.kind === 'lyric'))
    expect(lyricBlocks(true)).toEqual(lyricBlocks(false))
    for (const song of [amazingGrace, firstLight]) {
      const laid = layoutPdf(song, options({ concert: song.originalKey, showChords: true }))
      expect(laid.pages.flatMap((page) => page.blocks).some((block) => block.kind === 'section' && block.continued)).toBe(false)
    }
  })

  it('wraps a long list onto a second line that stays inside the page', () => {
    const many = fromChordPro(`{title: Many}\n{key: C}\n{start_of_verse: Verse 1}\n${['C', 'Dm7', 'Em7', 'Fmaj7', 'G7sus4', 'Am7', 'Bm7b5', 'Cmaj7/E', 'Dm7/G', 'E7#9', 'Fadd9/A', 'Gsus4/D', 'Abmaj7', 'Bbadd9', 'C/G', 'D7/F#', 'Esus4', 'F#m7b5', 'G/B', 'Am/G', 'Bb/D', 'Cadd9', 'Dsus2', 'Em/D'].map((chord) => `[${chord}]la `).join('')}\n{end_of_verse}\n`)
    const lines = layoutPdf(many, options({ concert: parseKey('C'), showChords: true })).pages[0].chordsUsed ?? []
    expect(lines.length).toBeGreaterThan(1)
    const capacity = Math.floor((595 - 84) / (9 * 0.6))
    for (const line of lines) for (const chord of line) expect(chord.index + chord.label.length).toBeLessThanOrEqual(capacity)
  })

  it('draws without error', async () => {
    const laid = layoutPdf(amazingGrace, options({ showChords: true }))
    expect((await PDFDocument.load(await renderPdf(laid, fonts()))).getPageCount()).toBe(laid.pages.length)
  })
})

function layoutChordLabels(song: typeof firstLight): string[] {
  const seen: string[] = []
  for (const page of layoutPdf(song, options({ concert: song.originalKey })).pages) {
    for (const block of page.blocks) {
      const labels = block.kind === 'lyric' ? block.chords.map((chord) => chord.label) : block.kind === 'bars' ? block.text.split(/[\s|]+/).filter((part) => /^[A-G]/.test(part)) : []
      for (const label of labels) if (!seen.includes(label)) seen.push(label)
    }
  }
  return seen
}

describe('setlist cover page', () => {
  const chart = (title: string, key: string, extra: Partial<SetlistChart> = {}, tempo?: number): SetlistChart => ({
    song: emptySong({ id: title, title, originalKey: parseKey(key), tempo, timeSignature: tempo ? '4/4' : undefined }),
    capo: 0,
    concert: parseKey(key),
    ...extra,
  })
  const entries = [chart('Amazing Grace', 'G', {}, 84), chart('First Light', 'D', { capo: 2, notes: 'Capo 2 for acoustic' }), chart('Abide With Me', 'Eb', { notes: 'Start a cappella, band in on verse 3' })]
  const cover = { name: 'Sunday', date: 'Sun 1 Mar' }
  const many = (count: number) => Array.from({ length: count }, (_, index) => chart(`Song number ${index + 1}`, 'G', index % 3 === 0 ? { notes: 'Soft start, then build through the second chorus into the bridge' } : {}, 90))

  it('is left out unless asked for, giving exactly the PDF as before', () => {
    const before = layoutSetlist(entries, options(), false)
    expect(before.sheets.map((sheet) => sheet.kind)).toEqual(['song', 'song', 'song'])
    const withCover = layoutSetlist(entries, options(), false, cover)
    expect(withCover.sheets.map((sheet) => sheet.kind)).toEqual(['cover', 'song', 'song', 'song'])
    expect(withCover.sheets.slice(1)).toEqual(before.sheets)
    expect(withCover.pageCount).toBe(before.pageCount + 1)
  })

  it('leaves every song page footer as it was: cover pages are not counted', () => {
    const footers = (layout: ReturnType<typeof layoutSetlist>) => layout.sheets.flatMap((sheet) => (sheet.kind === 'song' ? sheet.layout.pages.map((page) => `${page.footerTitle} | ${page.pageLabel}`) : []))
    expect(footers(layoutSetlist(entries, options(), false, cover))).toEqual(footers(layoutSetlist(entries, options(), false)))
    expect(footers(layoutSetlist(entries, options(), false, cover))[0]).toBe('Amazing Grace · Key G | Song 1 of 3 · Page 1 of 1')
  })

  it('lays out the heading and one row a song', () => {
    const [page] = layoutCover(cover, entries, options())
    expect({ heading: page.heading, date: page.date, fontSize: page.fontSize }).toEqual({ heading: 'Sunday', date: 'Sun 1 Mar', fontSize: 12 })
    expect(page.rows.map(({ number, title, key, meter, notes, order }) => ({ number, title, key, meter, notes, order }))).toMatchInlineSnapshot(`
      [
        {
          "key": [
            "G",
          ],
          "meter": "4/4 · 84 bpm",
          "notes": [],
          "number": "1",
          "order": "V1",
          "title": [
            "Amazing Grace",
          ],
        },
        {
          "key": [
            "D",
            "Capo 2 · C shapes",
          ],
          "meter": "",
          "notes": [
            "Capo 2 for acoustic",
          ],
          "number": "2",
          "order": "V1",
          "title": [
            "First Light",
          ],
        },
        {
          "key": [
            "Eb",
          ],
          "meter": "",
          "notes": [
            "Start a cappella,",
            "band in on verse 3",
          ],
          "number": "3",
          "order": "V1",
          "title": [
            "Abide With Me",
          ],
        },
      ]
    `)
  })

  it('spells keys with the export\'s accidentals', () => {
    const sharp = [chart('Sharp', 'F#', { capo: 1 })]
    const key = (bias: 'flats' | 'sharps') => layoutCover(cover, sharp.map((entry) => ({ ...entry, concert: bias === 'flats' ? parseKey('Gb') : parseKey('F#') })), options({ prefs: prefsForBias(bias) }))[0].rows[0].key
    expect(key('flats')).toEqual(['Gb', 'Capo 1 · F shapes'])
    expect(key('sharps')).toEqual(['F#', 'Capo 1 · F shapes'])
  })

  it('fits 12 songs on one page at A4 and US Letter', () => {
    for (const paper of ['a4', 'letter'] as const) expect(layoutCover(cover, many(12), options({ paper }))).toHaveLength(1)
  })

  it('shrinks to 10 pt and then runs 40 songs onto a second page without splitting a row', () => {
    const pages = layoutCover(cover, many(40), options())
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.map((page) => page.fontSize)).toEqual(pages.map(() => 10))
    expect(pages[1].heading).toBe('Sunday (cont.)')
    expect(pages.flatMap((page) => page.rows.map((row) => row.number))).toEqual(many(40).map((_, index) => String(index + 1)))
    for (const page of pages) {
      const body = page.height - 84 - (page.first ? 64 : 32) - 20
      for (const row of page.rows) expect(row.top + row.height).toBeLessThanOrEqual(body)
    }
  })

  it('drops the arrangement column before shrinking the type', () => {
    const page = layoutCover(cover, many(30), options())[0]
    expect(page.columns.order).toBeNull()
  })

  it('draws one PDF page per cover page', async () => {
    const pages = layoutCover(cover, many(40), options())
    const drawn = await PDFDocument.load(await renderCover(pages, fonts()))
    expect(drawn.getPageCount()).toBe(pages.length)
  })
})
