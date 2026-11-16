import { DEFAULT_PREFS, formatKey, keyFromPitch, notePitch, shiftKey, type Key, type SpellingPrefs } from './chord'
import type { Setlist, SetlistEntry } from './library-types'
import type { Song } from './song'

/** Adds a song at the end of a setlist, in the key and capo it is being viewed in. The song itself is unchanged. */
export function addSongToSetlist(setlist: Setlist, song: Song, view: { concert: Key; capo: number }): Setlist {
  const entry: SetlistEntry = { songId: song.id }
  if (formatKey(view.concert) !== formatKey(song.originalKey)) entry.key = view.concert
  if (view.capo > 0) entry.capo = view.capo
  return { ...setlist, entries: [...setlist.entries, entry] }
}

/** Undated drafts first, since they are being planned, then the newest service date. */
export function setlistsNewestFirst(setlists: Setlist[]): Setlist[] {
  return [...setlists].sort((a, b) => {
    if (!a.date !== !b.date) return a.date ? 1 : -1
    return b.date.localeCompare(a.date)
  })
}

export type LastPlayed = { date: string; key: Key; capo: number; setlistName: string }

/**
 * When a song was last played, read from past setlists: nothing extra is stored.
 * Only setlists dated before `today` (`YYYY-MM-DD`) count, so drafts, future services and today's are left out.
 */
export function lastPlayed(song: Song, setlists: Setlist[], today: string): LastPlayed | null {
  let latest: { setlist: Setlist; entry: SetlistEntry } | null = null
  for (const setlist of setlists) {
    if (!setlist.date || setlist.date >= today) continue
    const entry = setlist.entries.find((item) => item.songId === song.id)
    if (entry && (!latest || setlist.date > latest.setlist.date)) latest = { setlist, entry }
  }
  if (!latest) return null
  return { date: latest.setlist.date, key: latest.entry.key ?? song.originalKey, capo: latest.entry.capo ?? 0, setlistName: latest.setlist.name }
}

/** A calendar date such as `2026-03-03` as a local Date, so it never slips a day in other time zones. */
function localDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

/** `Last played 3 Mar · A · Capo 2`, in the device's date style, with the year only when it is not this year. */
export function lastPlayedLabel(played: LastPlayed | null, today: string, locale?: string): string {
  if (!played) return 'Not played yet'
  const sameYear = played.date.slice(0, 4) === today.slice(0, 4)
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(localDate(played.date))
  return [`Last played ${date}`, formatKey(played.key), ...(played.capo > 0 ? [`Capo ${played.capo}`] : [])].join(' · ')
}

/** Today as `YYYY-MM-DD` on this device's calendar. */
export function todayDate(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The setlist as plain text for the band chat: a heading, then one numbered line per song. */
export function runningOrderText(setlist: Setlist, songs: Song[], prefs: SpellingPrefs = DEFAULT_PREFS, locale?: string): string {
  const date = setlist.date ? new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(localDate(setlist.date)) : ''
  const heading = [setlist.name.trim() || 'Untitled setlist', date].filter(Boolean).join(' · ')
  const lines = setlist.entries.map((entry, index) => {
    const song = songs.find((item) => item.id === entry.songId)
    if (!song) return `${index + 1}. Missing song`
    const written = entry.key ?? song.originalKey
    const key = keyFromPitch(notePitch(written.tonic), written.mode, prefs)
    const capo = entry.capo ?? 0
    const shapes = capo > 0 ? `, capo ${capo} (${formatKey(shiftKey(key, -capo, prefs)).replace(/m$/, '')} shapes)` : ''
    const notes = entry.notes?.split(/\s*\n\s*/).map((line) => line.trim()).filter(Boolean).join(' ')
    return `${index + 1}. ${song.title} — ${formatKey(key)}${shapes}${notes ? ` · ${notes}` : ''}`
  })
  return [heading, ...lines].join('\n')
}

/** Where a deleted song sat in each setlist, kept so an undo can put it back exactly. */
export type RemovedEntries = { setlistId: string; entries: { index: number; entry: SetlistEntry }[] }[]

/** Takes a song out of every setlist, and reports what was taken from where. */
export function removeSongFromSetlists(setlists: Setlist[], songId: string): { setlists: Setlist[]; removed: RemovedEntries } {
  const removed: RemovedEntries = []
  const next = setlists.map((setlist) => {
    const entries = setlist.entries.flatMap((entry, index) => (entry.songId === songId ? [{ index, entry }] : []))
    if (entries.length === 0) return setlist
    removed.push({ setlistId: setlist.id, entries })
    return { ...setlist, entries: setlist.entries.filter((entry) => entry.songId !== songId) }
  })
  return { setlists: next, removed }
}

/**
 * Puts removed entries back at the positions they held, with the same key, capo and notes.
 * A setlist deleted in the meantime is left alone. Returns every setlist, and which ones changed.
 */
export function restoreSongEntries(setlists: Setlist[], removed: RemovedEntries): { setlists: Setlist[]; changed: Setlist[] } {
  const changed: Setlist[] = []
  const next = setlists.map((setlist) => {
    const taken = removed.find((item) => item.setlistId === setlist.id)
    if (!taken) return setlist
    const entries = [...setlist.entries]
    for (const { index, entry } of [...taken.entries].sort((a, b) => a.index - b.index)) entries.splice(Math.min(index, entries.length), 0, entry)
    const restored = { ...setlist, entries }
    changed.push(restored)
    return restored
  })
  return { setlists: next, changed }
}
