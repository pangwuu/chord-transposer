export type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export type Accidental = '' | '#' | 'b' | '##' | 'bb'

export type Note = {
  letter: Letter
  accidental: Accidental
}

export type Chord = {
  root: Note
  quality: string
  bass?: Note
  raw: string
}

export type ChordSymbol =
  | { kind: 'chord'; chord: Chord }
  | { kind: 'nc'; raw: string }
  | { kind: 'invalid'; raw: string }

export type KeyMode = 'major' | 'minor'

export type Key = {
  tonic: Note
  mode: KeyMode
}

export type SpellingPrefs = {
  gb: boolean
  csharp: boolean
}

/**
 * Exclusive accidental notation preference.
 * - default: key-aware spelling (SPEC), ambiguous keys named F# and Db
 * - flats / sharps: force flat or sharp chromatic spelling for displayed chords
 */
export type AccidentalBias = 'default' | 'flats' | 'sharps'

export const DEFAULT_PREFS: SpellingPrefs = { gb: false, csharp: false }

const FLAT_CHROMATIC = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const
const SHARP_CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export function prefsForBias(bias: AccidentalBias): SpellingPrefs {
  if (bias === 'flats') return { gb: true, csharp: false }
  if (bias === 'sharps') return { gb: false, csharp: true }
  return { ...DEFAULT_PREFS }
}

export function accidentalBias(prefs: SpellingPrefs): AccidentalBias {
  if (prefs.gb && !prefs.csharp) return 'flats'
  if (!prefs.gb && prefs.csharp) return 'sharps'
  return 'default'
}

/** Select flats or sharps exclusively; selecting the active bias again restores the default (F# · Db). */
export function chooseAccidentalBias(prefs: SpellingPrefs, next: 'flats' | 'sharps'): SpellingPrefs {
  return accidentalBias(prefs) === next ? prefsForBias('default') : prefsForBias(next)
}

const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]
const PITCH_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

const OPEN_SPELLING: Note[] = [
  { letter: 'C', accidental: '' },
  { letter: 'C', accidental: '#' },
  { letter: 'D', accidental: '' },
  { letter: 'E', accidental: 'b' },
  { letter: 'E', accidental: '' },
  { letter: 'F', accidental: '' },
  { letter: 'F', accidental: '#' },
  { letter: 'G', accidental: '' },
  { letter: 'A', accidental: 'b' },
  { letter: 'A', accidental: '' },
  { letter: 'B', accidental: 'b' },
  { letter: 'B', accidental: '' },
]

const QUALITIES = new Set([
  '',
  'm',
  'min',
  'M',
  'maj',
  '7',
  'maj7',
  'M7',
  'Δ',
  'Δ7',
  'm7',
  'min7',
  'sus',
  'sus2',
  'sus4',
  'add9',
  'add2',
  'add4',
  'add11',
  '2',
  '4',
  '5',
  '6',
  'm6',
  '9',
  '11',
  '13',
  'dim',
  'dim7',
  '°',
  '°7',
  'aug',
  'aug7',
  '+',
  '+7',
  'm7b5',
  'm7#5',
  'ø',
  'ø7',
  'maj9',
  'm9',
  'm11',
  'm13',
  '7sus4',
  '9sus4',
  'maj7#11',
])

const MAJOR_QUALITIES = ['', 'm', 'm', '', '', 'm', 'dim']
const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const MINOR_QUALITIES = ['m', 'dim', '', 'm', 'm', '', '']
const MINOR_NUMERALS = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']

export function notePitch(note: Note): number {
  const base = NATURAL[note.letter]
  const shift = note.accidental === '#' ? 1 : note.accidental === '##' ? 2 : note.accidental === 'b' ? -1 : note.accidental === 'bb' ? -2 : 0
  return (base + shift + 12) % 12
}

export function formatNote(note: Note): string {
  return note.letter + note.accidental
}

export function formatChord(chord: Chord): string {
  const bass = chord.bass ? `/${formatNote(chord.bass)}` : ''
  return `${formatNote(chord.root)}${chord.quality}${bass}`
}

export function formatSymbol(symbol: ChordSymbol): string {
  if (symbol.kind === 'chord') return formatChord(symbol.chord)
  return symbol.raw
}

const QUALITY_ALIASES: Record<string, string> = {
  min: 'm',
  M7: 'maj7',
  Δ: 'maj7',
  Δ7: 'maj7',
  sus: 'sus4',
  min7: 'm7',
}

export function normaliseSymbol(symbol: ChordSymbol): ChordSymbol {
  if (symbol.kind !== 'chord') return symbol
  const quality = QUALITY_ALIASES[symbol.chord.quality] ?? symbol.chord.quality
  if (quality === symbol.chord.quality) return symbol
  const chord: Chord = { ...symbol.chord, quality, raw: '' }
  chord.raw = formatChord(chord)
  return { kind: 'chord', chord }
}

function isQuality(quality: string): boolean {
  if (QUALITIES.has(quality)) return true
  const stripped = quality.replace(/(#|b)\d+$/, '')
  return stripped !== quality && QUALITIES.has(stripped)
}

function parseNote(source: string): { note: Note; rest: string } | null {
  const letter = source[0]?.toUpperCase()
  if (!letter || !LETTERS.includes(letter as Letter)) return null
  const rest = source.slice(1)
  if (rest.startsWith('##')) return { note: { letter: letter as Letter, accidental: '##' }, rest: rest.slice(2) }
  if (rest.startsWith('♯♯')) return { note: { letter: letter as Letter, accidental: '##' }, rest: rest.slice(2) }
  if (rest.startsWith('#') || rest.startsWith('♯')) return { note: { letter: letter as Letter, accidental: '#' }, rest: rest.slice(1) }
  if (rest.startsWith('bb') || rest.startsWith('♭♭')) return { note: { letter: letter as Letter, accidental: 'bb' }, rest: rest.slice(2) }
  if (rest.startsWith('b') || rest.startsWith('♭')) return { note: { letter: letter as Letter, accidental: 'b' }, rest: rest.slice(1) }
  return { note: { letter: letter as Letter, accidental: '' }, rest }
}

export function parseChord(rawInput: string): ChordSymbol {
  const raw = rawInput.trim()
  if (/^n\.?c\.?$/i.test(raw)) return { kind: 'nc', raw: raw.toUpperCase() === 'NC' ? 'NC' : 'N.C.' }
  const root = parseNote(raw)
  if (!root) return { kind: 'invalid', raw }
  let quality = root.rest
  let bass: Note | undefined
  const slash = quality.indexOf('/')
  if (slash >= 0) {
    const bassText = quality.slice(slash + 1)
    quality = quality.slice(0, slash)
    const parsedBass = parseNote(bassText)
    if (!parsedBass || parsedBass.rest.length > 0) return { kind: 'invalid', raw }
    bass = parsedBass.note
  }
  if (!isQuality(quality)) return { kind: 'invalid', raw }
  const chord: Chord = { root: root.note, quality, bass, raw }
  chord.raw = formatChord(chord)
  return { kind: 'chord', chord }
}

function scaleNotes(key: Key): Note[] {
  const steps = key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS
  const start = LETTERS.indexOf(key.tonic.letter)
  const tonic = notePitch(key.tonic)
  return steps.map((step, index) => {
    const letter = LETTERS[(start + index) % 7]
    return { letter, accidental: accidentalFor(NATURAL[letter], (tonic + step) % 12) }
  })
}

function accidentalFor(natural: number, target: number): Accidental {
  let delta = (target - natural + 12) % 12
  if (delta > 6) delta -= 12
  if (delta === 0) return ''
  if (delta === 1) return '#'
  if (delta === 2) return '##'
  if (delta === -1) return 'b'
  if (delta === -2) return 'bb'
  throw new Error(`Cannot spell pitch ${target} on natural ${natural}`)
}

function signatureStyle(scale: Note[]): 'sharp' | 'flat' | 'open' {
  const sharp = scale.some((note) => note.accidental.includes('#'))
  const flat = scale.some((note) => note.accidental.includes('b'))
  if (sharp && !flat) return 'sharp'
  if (flat && !sharp) return 'flat'
  return 'open'
}

function noteFromName(name: string): Note {
  const parsed = parseNote(name)
  if (!parsed || parsed.rest.length > 0) throw new Error(`Unknown note ${name}`)
  return parsed.note
}

export function spellPitch(pitch: number, key: Key, prefs: SpellingPrefs = DEFAULT_PREFS): Note {
  const wrapped = ((pitch % 12) + 12) % 12
  const bias = accidentalBias(prefs)
  if (bias === 'flats') return noteFromName(FLAT_CHROMATIC[wrapped])
  if (bias === 'sharps') return noteFromName(SHARP_CHROMATIC[wrapped])

  const scale = scaleNotes(key)
  const diatonic = scale.find((note) => notePitch(note) === wrapped)
  if (diatonic) return { ...diatonic }
  if (signatureStyle(scale) === 'open') return { ...OPEN_SPELLING[wrapped] }

  const style = signatureStyle(scale)
  let best: Note = OPEN_SPELLING[wrapped]
  let bestScore = Number.POSITIVE_INFINITY
  for (const letter of LETTERS) {
    let delta = (wrapped - NATURAL[letter] + 12) % 12
    if (delta > 6) delta -= 12
    if (delta < -2 || delta > 2) continue
    const accidental: Accidental = delta === 0 ? '' : delta === 1 ? '#' : delta === 2 ? '##' : delta === -1 ? 'b' : 'bb'
    const abs = Math.abs(delta)
    const against = style === 'sharp' ? accidental.includes('b') : accidental.includes('#')
    const score = abs * 10 + (against ? 3 : 0)
    if (score < bestScore) {
      bestScore = score
      best = { letter, accidental }
    }
  }
  return best
}

export function parseKey(name: string): Key {
  const trimmed = name.trim()
  const minor = /m$/i.test(trimmed) && !/maj/i.test(trimmed)
  const tonicText = minor ? trimmed.slice(0, -1) : trimmed
  const parsed = parseNote(tonicText)
  if (!parsed || parsed.rest.length > 0) throw new Error(`Unknown key ${name}`)
  return { tonic: parsed.note, mode: minor ? 'minor' : 'major' }
}

export function formatKey(key: Key): string {
  return `${formatNote(key.tonic)}${key.mode === 'minor' ? 'm' : ''}`
}

export function keyFromPitch(pitch: number, mode: KeyMode, prefs: SpellingPrefs = DEFAULT_PREFS): Key {
  const wrapped = ((pitch % 12) + 12) % 12
  let name = PITCH_NAMES[wrapped]
  if (prefs.gb && name === 'F#') name = 'Gb'
  if (prefs.csharp && name === 'Db') name = 'C#'
  if (prefs.gb && name === 'F#' ) name = 'Gb'
  const key = parseKey(name)
  if (mode === 'minor') {
    const minorPitch = wrapped
    let minorName = PITCH_NAMES[minorPitch]
    if (prefs.gb && minorName === 'F#') minorName = 'Gb'
    if (prefs.csharp && minorName === 'Db') minorName = 'C#'
    return parseKey(`${minorName}m`)
  }
  return key
}

export function shiftKey(key: Key, semitones: number, prefs: SpellingPrefs = DEFAULT_PREFS): Key {
  return keyFromPitch(notePitch(key.tonic) + semitones, key.mode, prefs)
}

export function signedInterval(from: Key, to: Key): number {
  let delta = notePitch(to.tonic) - notePitch(from.tonic)
  if (delta > 6) delta -= 12
  if (delta < -6) delta += 12
  return delta
}

export function transposeSymbol(
  symbol: ChordSymbol,
  semitones: number,
  targetKey: Key,
  prefs: SpellingPrefs = DEFAULT_PREFS,
): ChordSymbol {
  if (symbol.kind === 'nc') return { kind: 'nc', raw: symbol.raw }
  if (symbol.kind === 'invalid') return { kind: 'invalid', raw: symbol.raw }
  const root = spellPitch(notePitch(symbol.chord.root) + semitones, targetKey, prefs)
  const bass = symbol.chord.bass ? spellPitch(notePitch(symbol.chord.bass) + semitones, targetKey, prefs) : undefined
  const chord: Chord = { root, quality: symbol.chord.quality, bass, raw: '' }
  chord.raw = formatChord(chord)
  return { kind: 'chord', chord }
}

export type Suggestion = { symbol: string; numeral: string }

function withBass(root: Note, quality: string, bass: Note): string {
  return formatChord({ root, quality, bass, raw: '' })
}

function flatten(note: Note): Note {
  const order: Accidental[] = ['##', '#', '', 'b', 'bb']
  const index = order.indexOf(note.accidental)
  return { letter: note.letter, accidental: order[Math.min(index + 1, order.length - 1)] }
}

export function suggestionsFor(key: Key): Suggestion[] {
  const scale = scaleNotes(key)
  const qualities = key.mode === 'major' ? MAJOR_QUALITIES : MINOR_QUALITIES
  const numerals = key.mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS
  const diatonic = scale.map((note, index) => ({
    symbol: formatChord({ root: note, quality: qualities[index], raw: '' }),
    numeral: numerals[index],
  }))
  const slash = [
    { symbol: withBass(scale[0], '', scale[2]), numeral: 'I/3' },
    { symbol: withBass(scale[3], '', scale[5]), numeral: 'IV/6' },
    { symbol: withBass(scale[4], '', scale[6]), numeral: 'V/7' },
    { symbol: withBass(scale[0], '', scale[4]), numeral: 'I/5' },
  ]
  const sus = [
    { symbol: formatChord({ root: scale[0], quality: 'sus', raw: '' }), numeral: 'Isus' },
    { symbol: formatChord({ root: scale[4], quality: 'sus', raw: '' }), numeral: 'Vsus' },
  ]
  const borrowed = [2, 5, 6].map((degree) => {
    const note = flatten(scale[degree])
    const numeral = degree === 2 ? 'bIII' : degree === 5 ? 'bVI' : 'bVII'
    return { symbol: formatNote(note), numeral }
  })
  return [...diatonic, ...slash, ...sus, ...borrowed]
}

export function nashville(symbol: ChordSymbol, key: Key): string {
  if (symbol.kind !== 'chord') return formatSymbol(symbol)
  const root = degreeLabel(symbol.chord.root, key)
  const bass = symbol.chord.bass ? `/${degreeLabel(symbol.chord.bass, key)}` : ''
  return `${root}${symbol.chord.quality}${bass}`
}

function degreeLabel(note: Note, key: Key): string {
  const rel = (notePitch(note) - notePitch(key.tonic) + 12) % 12
  const steps = key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS
  const exact = steps.indexOf(rel)
  if (exact >= 0) return String(exact + 1)
  if (note.accidental.includes('#')) {
    const lower = steps.indexOf((rel + 11) % 12)
    if (lower >= 0) return `#${lower + 1}`
  }
  const upper = steps.indexOf((rel + 1) % 12)
  if (upper >= 0) return `b${upper + 1}`
  return String(rel)
}

export function friendlyCapos(concert: Key): { capo: number; shapes: string }[] {
  const wanted = ['C', 'G', 'D', 'A', 'E']
  const concertPitch = notePitch(concert.tonic)
  return wanted.map((name) => {
    const shape = notePitch(parseKey(name).tonic)
    const capo = (concertPitch - shape + 12) % 12
    return { capo, shapes: name }
  })
}

export function sameChord(a: ChordSymbol, b: ChordSymbol): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'invalid' && b.kind === 'invalid') return a.raw === b.raw
  if (a.kind === 'nc' && b.kind === 'nc') return true
  if (a.kind !== 'chord' || b.kind !== 'chord') return false
  return (
    notePitch(a.chord.root) === notePitch(b.chord.root) &&
    a.chord.quality === b.chord.quality &&
    (a.chord.bass ? notePitch(a.chord.bass) : null) === (b.chord.bass ? notePitch(b.chord.bass) : null)
  )
}
