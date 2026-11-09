import { useState } from 'react'
import { formatKey, parseKey } from '../domain/chord'
import type { Setlist } from '../domain/library-types'
import type { Song } from '../domain/song'

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export function SetlistScreen({
  songs,
  setlists,
  onCreate,
  onChange,
  onDelete,
  onExport,
  onStage,
}: {
  songs: Song[]
  setlists: Setlist[]
  onCreate: () => void
  onChange: (setlist: Setlist) => void
  onDelete: (id: string) => void
  onExport: (setlist: Setlist, rightHand: boolean) => void
  onStage: (setlist: Setlist) => void
}) {
  const [rightHand, setRightHand] = useState(false)
  return (
    <div className="setlists">
      <div className="row-meta">
        <h2>Setlists</h2>
        <span className="grow" />
        <label className="hint"><input type="checkbox" checked={rightHand} onChange={(event) => setRightHand(event.target.checked)} /> Right-hand pages</label>
        <button className="primary" type="button" onClick={onCreate}>+ New setlist</button>
      </div>
      {setlists.length === 0 && <p className="empty">No setlists yet. A setlist is an ordered list of songs for one date.</p>}
      {setlists.map((setlist) => (
        <article key={setlist.id} className="empty">
          <div className="row-meta">
            <input className="field" aria-label="Setlist name" value={setlist.name} onChange={(event) => onChange({ ...setlist, name: event.target.value })} />
            <input className="field" aria-label="Setlist date" type="date" value={setlist.date} onChange={(event) => onChange({ ...setlist, date: event.target.value })} />
            <button className="outline" type="button" onClick={() => onStage(setlist)}>Stage</button>
            <button className="outline" type="button" onClick={() => onExport(setlist, rightHand)}>Export PDF</button>
            <button className="text-button" type="button" onClick={() => onDelete(setlist.id)}>Delete</button>
          </div>
          {setlist.entries.map((entry, index) => {
            const song = songs.find((item) => item.id === entry.songId)
            return (
              <div className="row-meta" key={`${entry.songId}-${index}`}>
                <strong>{index + 1}. {song?.title ?? 'Missing song'}</strong>
                <select className="select" aria-label={`Key for ${song?.title ?? 'song'}`} value={formatKey(entry.key ?? song?.originalKey ?? parseKey('C'))} onChange={(event) => onChange(updateEntry(setlist, index, { key: parseKey(event.target.value) }))}>
                  {KEYS.map((key) => <option key={key}>{key}</option>)}
                </select>
                <select className="select" aria-label={`Capo for ${song?.title ?? 'song'}`} value={entry.capo ?? 0} onChange={(event) => onChange(updateEntry(setlist, index, { capo: Number(event.target.value) }))}>
                  {Array.from({ length: 12 }, (_, capo) => <option key={capo} value={capo}>{capo === 0 ? 'No capo' : `Capo ${capo}`}</option>)}
                </select>
                <input className="field" aria-label="Notes" value={entry.notes ?? ''} placeholder="Notes" onChange={(event) => onChange(updateEntry(setlist, index, { notes: event.target.value }))} />
                <button className="text-button" type="button" onClick={() => onChange(moveEntry(setlist, index, -1))}>Up</button>
                <button className="text-button" type="button" onClick={() => onChange(moveEntry(setlist, index, 1))}>Down</button>
                <button className="text-button" type="button" onClick={() => onChange({ ...setlist, entries: setlist.entries.filter((_, item) => item !== index) })}>Remove</button>
              </div>
            )
          })}
          <select className="select" aria-label={`Add a song to ${setlist.name}`} value="" onChange={(event) => { if (event.target.value) onChange({ ...setlist, entries: [...setlist.entries, { songId: event.target.value }] }) }}>
            <option value="">Add song…</option>
            {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
          </select>
        </article>
      ))}
    </div>
  )
}

function updateEntry(setlist: Setlist, index: number, patch: Partial<Setlist['entries'][number]>): Setlist {
  return { ...setlist, entries: setlist.entries.map((entry, item) => (item === index ? { ...entry, ...patch } : entry)) }
}

function moveEntry(setlist: Setlist, index: number, direction: -1 | 1): Setlist {
  const target = index + direction
  if (target < 0 || target >= setlist.entries.length) return setlist
  const entries = [...setlist.entries]
  const [entry] = entries.splice(index, 1)
  entries.splice(target, 0, entry)
  return { ...setlist, entries }
}
