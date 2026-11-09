export type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export type Accidental = '' | '#' | 'b' | '##' | 'bb'

export type Note = {
  letter: Letter
  accidental: Accidental
}

export type Chord =
  | { kind: 'nc'; raw: string }
  | {
      kind: 'pitched'
      root: Note
      /** Normalised suffix: maj7, sus4, m, or '' for major. */
      quality: string
      /** Suffix as written, so CM7 is not rewritten to maj7 until asked. */
      qualityText: string
      bass?: Note
      raw: string
    }

export type ChordReading =
  { ok: true; chord: Chord } | { ok: false; raw: string }

export const MAJOR_KEYS = [
  'C',
  'Db',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

export const MINOR_KEYS = [
  'Am',
  'Bbm',
  'Bm',
  'Cm',
  'C#m',
  'Dm',
  'D#m',
  'Ebm',
  'Em',
  'Fm',
  'F#m',
  'Gm',
  'G#m',
  'A#m',
] as const

export type KeyName = (typeof MAJOR_KEYS)[number] | (typeof MINOR_KEYS)[number]

const QUALITIES: Record<string, string> = {
  '': '',
  m: 'm',
  min: 'm',
  mi: 'm',
  '7': '7',
  maj7: 'maj7',
  ma7: 'maj7',
  M7: 'maj7',
  Δ7: 'maj7',
  maj: '',
  M: '',
  sus: 'sus4',
  sus2: 'sus2',
  sus4: 'sus4',
  add9: 'add9',
  '2': '2',
  '5': '5',
  '6': '6',
  m6: 'm6',
  '9': '9',
  dim: 'dim',
  dim7: 'dim7',
  aug: 'aug',
  m7: 'm7',
  m7b5: 'm7b5',
  '+': 'aug',
  '°': 'dim',
  '°7': 'dim7',
  ø: 'm7b5',
  ø7: 'm7b5',
  min7: 'm7',
  min7b5: 'm7b5',
}

const LETTER_PITCH: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

const ACC_VALUE: Record<Accidental, number> = {
  '': 0,
  '#': 1,
  b: -1,
  '##': 2,
  bb: -2,
}

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
/** C and Am: sharps for raised tones (F#), flats for lowered ones (Bb). */
const NATURAL = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
]
const DEFAULT_KEY_BY_PITCH = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

const SHARP_MAJORS = new Set<string>(['G', 'D', 'A', 'E', 'B', 'F#', 'C#'])
const FLAT_MAJORS = new Set<string>(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'])
const KEYS = new Set<string>([...MAJOR_KEYS, ...MINOR_KEYS])

const RELATIVE_MAJOR: Partial<Record<KeyName, KeyName>> = {
  Am: 'C',
  Em: 'G',
  Bm: 'D',
  'F#m': 'A',
  'C#m': 'E',
  'G#m': 'B',
  'D#m': 'F#',
  'A#m': 'C#',
  Dm: 'F',
  Gm: 'Bb',
  Cm: 'Eb',
  Fm: 'Ab',
  Bbm: 'Db',
  Ebm: 'Gb',
}

const FRIENDLY_SHAPES = ['C', 'G', 'D', 'A', 'E'] as const

const NOTE_TOKEN = /^([A-G])(bb|##|b|#)?$/

function assertKey(key: string): asserts key is KeyName {
  if (!KEYS.has(key)) throw new Error(`Unknown key: ${key}`)
}

function parseNote(token: string): Note | null {
  const match = NOTE_TOKEN.exec(token)
  if (!match) return null
  return {
    letter: match[1] as Letter,
    accidental: (match[2] ?? '') as Accidental,
  }
}

function noteText(note: Note): string {
  return note.letter + note.accidental
}

function pitchOf(note: Note): number {
  return (LETTER_PITCH[note.letter] + ACC_VALUE[note.accidental] + 12) % 12
}

function tonicToken(key: KeyName): string {
  return key.endsWith('m') ? key.slice(0, -1) : key
}

function pitchOfKey(key: KeyName): number {
  const note = parseNote(tonicToken(key))
  if (!note) throw new Error(`Unknown key: ${key}`)
  return pitchOf(note)
}

const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]

function spellingBias(key: KeyName): readonly string[] {
  const major = RELATIVE_MAJOR[key] ?? key
  if (SHARP_MAJORS.has(major)) return SHARP
  if (FLAT_MAJORS.has(major)) return FLAT
  return NATURAL
}

function accidentalFor(letter: Letter, pitch: number): Accidental | null {
  const delta = (pitch - LETTER_PITCH[letter] + 12) % 12
  if (delta === 0) return ''
  if (delta === 1) return '#'
  if (delta === 2) return '##'
  if (delta === 11) return 'b'
  if (delta === 10) return 'bb'
  return null
}

function majorTonic(key: KeyName): Note {
  const majorName = RELATIVE_MAJOR[key] ?? key
  const note = parseNote(tonicToken(majorName))
  if (!note) throw new Error(`Unknown key: ${key}`)
  return note
}

/** One scale tone per letter, so F# major's 7th is E# and Gb major's 4th is Cb. */
function diatonicByLetter(key: KeyName): Record<Letter, Note> {
  const tonic = majorTonic(key)
  const start = LETTERS.indexOf(tonic.letter)
  const tonicPitch = pitchOf(tonic)
  const scale = {} as Record<Letter, Note>
  for (let step = 0; step < LETTERS.length; step++) {
    const letter = LETTERS[(start + step) % LETTERS.length]
    const pitch = (tonicPitch + MAJOR_STEPS[step]) % 12
    const accidental = accidentalFor(letter, pitch)
    if (accidental === null) throw new Error(`Cannot spell ${letter} in ${key}`)
    scale[letter] = { letter, accidental }
  }
  return scale
}

function spell(pitch: number, key: KeyName): Note {
  const wrapped = ((pitch % 12) + 12) % 12
  const diatonic = diatonicByLetter(key)
  const preferred = spellingBias(key)[wrapped]
  const candidates: { note: Note; distance: number }[] = []
  for (const letter of LETTERS) {
    const accidental = accidentalFor(letter, wrapped)
    if (accidental === null) continue
    candidates.push({
      note: { letter, accidental },
      distance: Math.abs(
        ACC_VALUE[accidental] - ACC_VALUE[diatonic[letter].accidental],
      ),
    })
  }
  candidates.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    const aPreferred = noteText(a.note) === preferred ? 0 : 1
    const bPreferred = noteText(b.note) === preferred ? 0 : 1
    if (aPreferred !== bPreferred) return aPreferred - bPreferred
    return a.note.letter.localeCompare(b.note.letter)
  })
  const chosen = candidates[0]
  if (!chosen) throw new Error(`Cannot spell pitch ${wrapped} in ${key}`)
  return chosen.note
}

export function readChord(input: string): ChordReading {
  const raw = input.trim()
  if (/^(?:N\.C\.|NC)$/i.test(raw)) {
    return { ok: true, chord: { kind: 'nc', raw } }
  }

  const match = /^([A-G])(bb|##|b|#)?(.*)$/.exec(raw)
  if (!match) return { ok: false, raw }

  const root = parseNote(`${match[1]}${match[2] ?? ''}`)
  if (!root) return { ok: false, raw }

  const rest = match[3]
  const bassMatch = /^(.*)\/([A-G](?:bb|##|b|#)?)$/.exec(rest)
  let qualityText = rest
  let bass: Note | undefined
  if (bassMatch) {
    const parsedBass = parseNote(bassMatch[2])
    if (!parsedBass) return { ok: false, raw }
    qualityText = bassMatch[1]
    bass = parsedBass
  }

  if (!Object.hasOwn(QUALITIES, qualityText)) return { ok: false, raw }

  return {
    ok: true,
    chord: {
      kind: 'pitched',
      root,
      bass,
      qualityText,
      quality: QUALITIES[qualityText],
      raw,
    },
  }
}

export function writeChord(
  chord: Chord,
  options?: { normalize?: boolean },
): string {
  if (chord.kind === 'nc') return chord.raw
  const quality = options?.normalize ? chord.quality : chord.qualityText
  const bass = chord.bass ? `/${noteText(chord.bass)}` : ''
  return `${noteText(chord.root)}${quality}${bass}`
}

export function transposeChord(
  chord: Chord,
  from: KeyName,
  to: KeyName,
): Chord {
  assertKey(from)
  assertKey(to)
  if (chord.kind === 'nc' || from === to) return chord

  const semitones = (pitchOfKey(to) - pitchOfKey(from) + 12) % 12
  const next: Chord = {
    kind: 'pitched',
    root: spell(pitchOf(chord.root) + semitones, to),
    bass: chord.bass ? spell(pitchOf(chord.bass) + semitones, to) : undefined,
    quality: chord.quality,
    qualityText: chord.qualityText,
    raw: '',
  }
  return { ...next, raw: writeChord(next) }
}

export function capoLine(concertKey: KeyName, capo: number): string {
  assertKey(concertKey)
  if (!Number.isInteger(capo) || capo <= 0) return ''
  const shapePitch = (pitchOfKey(concertKey) - (capo % 12) + 12) % 12
  const shape = DEFAULT_KEY_BY_PITCH[shapePitch]
  return `Capo ${capo} — play ${shape} shapes (sounds in ${concertKey})`
}

export function shiftKey(key: KeyName, semitones: number): KeyName {
  assertKey(key)
  const pitch = (pitchOfKey(key) + semitones + 120) % 12
  const minor = MINOR_KEYS.includes(key as (typeof MINOR_KEYS)[number])
  const names = minor ? MINOR_KEYS : MAJOR_KEYS
  const preferred = `${DEFAULT_KEY_BY_PITCH[pitch]}${minor ? 'm' : ''}`
  const preferredMatch = names.find((name) => name === preferred)
  if (preferredMatch) return preferredMatch
  const fallback = names.find((name) => pitchOfKey(name) === pitch)
  if (!fallback) throw new Error(`No key at pitch ${pitch}`)
  return fallback
}

export function friendlyCapos(
  concertKey: KeyName,
): { capo: number; shapeKey: KeyName }[] {
  assertKey(concertKey)
  const concert = pitchOfKey(concertKey)
  return FRIENDLY_SHAPES.map((shapeKey) => ({
    shapeKey,
    capo: (concert - pitchOfKey(shapeKey) + 12) % 12,
  }))
}
