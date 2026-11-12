import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate'
import type { Setlist } from './library-types'
import type { Song } from './song'

/** What travels in a share link or a shared file: songs, and optionally the setlist that orders them. */
export type ShareBundle = {
  version: 2
  setlist?: Setlist
  songs: Song[]
}

type Encoded = { ok: true; hash: string } | { ok: false; reason: 'too-large' }

const LINK_LIMIT = 12000

export function encodeShare(song: Song, limit = LINK_LIMIT): Encoded {
  return pack('1', song, limit)
}

export function decodeShare(hash: string): Song {
  return readShare(hash.includes('.') ? hash : `1.${hash}`).songs[0]
}

/** A setlist with the songs it uses, and no others. An entry whose song is gone is left out. */
export function bundleSetlist(setlist: Setlist, songs: Song[]): ShareBundle {
  const used = new Set(setlist.entries.map((entry) => entry.songId))
  const carried = songs.filter((song) => used.has(song.id))
  const held = new Set(carried.map((song) => song.id))
  const entries = setlist.entries.filter((entry) => held.has(entry.songId))
  return { version: 2, setlist: entries.length === setlist.entries.length ? setlist : { ...setlist, entries }, songs: carried }
}

export function encodeBundle(bundle: ShareBundle, limit = LINK_LIMIT): Encoded {
  return pack('2', bundle, limit)
}

/** Reads a share link hash (`1.` one song, `2.` a bundle) or the text of a shared file. Throws when it is neither, or is malformed. */
export function readShare(text: string): ShareBundle {
  const input = text.trim()
  if (input.startsWith('1.')) return checkBundle({ version: 2, songs: [unpack(input.slice(2))] })
  if (input.startsWith('2.')) return checkBundle(unpack(input.slice(2)))
  if (input.startsWith('{')) return checkBundle(JSON.parse(input))
  throw new Error('Not a share link or a shared file')
}

export type MergePlan = {
  /** Songs the library does not have. */
  added: Song[]
  /** Songs the library has an older copy of. */
  updated: Song[]
  setlist?: { status: 'new' | 'changed' | 'same'; value: Setlist }
}

/** Works out what a bundle would add to a library. A local song that is as new or newer is left alone. */
export function mergeBundle(library: { songs: Song[]; setlists: Setlist[] }, bundle: ShareBundle): MergePlan {
  const local = new Map(library.songs.map((song) => [song.id, song]))
  const plan: MergePlan = { added: [], updated: [] }
  for (const song of bundle.songs) {
    const mine = local.get(song.id)
    if (!mine) plan.added.push(song)
    else if (Date.parse(song.updatedAt) > Date.parse(mine.updatedAt)) plan.updated.push(song)
  }
  if (bundle.setlist) {
    const mine = library.setlists.find((setlist) => setlist.id === bundle.setlist?.id)
    const status = !mine ? 'new' : JSON.stringify(mine) === JSON.stringify(bundle.setlist) ? 'same' : 'changed'
    plan.setlist = { status, value: bundle.setlist }
  }
  return plan
}

function checkBundle(value: unknown): ShareBundle {
  const bundle = record(value, 'bundle')
  need(bundle.version === 2, 'Unsupported share version')
  const songs = list(bundle.songs, 'songs').map(checkSong)
  if (bundle.setlist === undefined) return { version: 2, songs }
  const setlist = checkSetlist(bundle.setlist)
  const ids = new Set(songs.map((song) => song.id))
  need(setlist.entries.every((entry) => ids.has(entry.songId)), 'A song in the setlist is missing from the bundle')
  return { version: 2, setlist, songs }
}

function checkSong(value: unknown): Song {
  const song = record(value, 'song')
  text(song.id, 'song id')
  text(song.title, 'song title')
  text(song.updatedAt, 'song date')
  const key = record(song.originalKey, 'song key')
  need(key.mode === 'major' || key.mode === 'minor', 'Bad song key')
  for (const item of list(song.sections, 'sections')) {
    const section = record(item, 'section')
    text(section.id, 'section id')
    text(section.label, 'section label')
    for (const entry of list(section.lines, 'lines')) {
      const line = record(entry, 'line')
      text(line.id, 'line id')
      if (line.type === 'lyric') {
        text(line.text, 'lyric text')
        list(line.chords, 'chords')
      } else if (line.type === 'bars') list(line.items, 'bar items')
      else if (line.type === 'comment') text(line.text, 'comment text')
      else throw new Error('Unknown line type')
    }
  }
  for (const item of list(song.arrangement, 'arrangement')) text(record(item, 'arrangement item').sectionId, 'arrangement section')
  list(song.views, 'views')
  return value as Song
}

function checkSetlist(value: unknown): Setlist {
  const setlist = record(value, 'setlist')
  text(setlist.id, 'setlist id')
  text(setlist.name, 'setlist name')
  text(setlist.date, 'setlist date')
  for (const item of list(setlist.entries, 'entries')) text(record(item, 'entry').songId, 'entry song')
  return value as Setlist
}

function need(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function record(value: unknown, name: string): Record<string, unknown> {
  need(typeof value === 'object' && value !== null && !Array.isArray(value), `Bad ${name}`)
  return value as Record<string, unknown>
}

function list(value: unknown, name: string): unknown[] {
  need(Array.isArray(value), `Bad ${name}`)
  return value
}

function text(value: unknown, name: string): void {
  need(typeof value === 'string', `Bad ${name}`)
}

function pack(version: string, value: unknown, limit: number): Encoded {
  const compressed = gzipSync(strToU8(JSON.stringify(value)), { level: 9 })
  const hash = `${version}.${toBase64Url(compressed)}`
  if (hash.length > limit) return { ok: false, reason: 'too-large' }
  return { ok: true, hash }
}

function unpack(payload: string): unknown {
  return JSON.parse(strFromU8(gunzipSync(fromBase64Url(payload))))
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
