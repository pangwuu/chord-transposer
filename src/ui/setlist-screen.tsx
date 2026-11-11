import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { formatKey, parseKey } from '../domain/chord'
import type { Setlist, SetlistEntry } from '../domain/library-types'
import type { Song } from '../domain/song'

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const NARROW_PANE = 640

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
  const rootRef = useRef<HTMLDivElement>(null)
  const narrow = useNarrowPane(rootRef, NARROW_PANE)
  const [rightHand, setRightHand] = useState(false)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [extra, setExtra] = useState<{ index: number; field: 'capo' | 'notes' } | null>(null)
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    setExtra(null)
  }, [openedId])

  useEffect(() => {
    const ids = setlists.map((setlist) => setlist.id)
    if (seen.current === null) {
      seen.current = new Set(ids)
      return
    }
    const added = ids.find((id) => !seen.current?.has(id))
    seen.current = new Set(ids)
    if (added) setOpenedId(added)
    else setOpenedId((current) => (current && ids.includes(current) ? current : null))
  }, [setlists])

  const opened = setlists.find((setlist) => setlist.id === openedId) ?? null
  const shown = narrow ? opened : (opened ?? setlists[0] ?? null)
  const showList = !narrow || opened === null

  return (
    <div className="setlists" ref={rootRef}>
      <div className="setlists-column">
        {showList && (
          <>
            <div className="screen-head">
              <h2>Setlists</h2>
              <button className="primary" type="button" onClick={onCreate}>+ New setlist</button>
            </div>
            {setlists.length === 0 && <p className="empty">No setlists yet. A setlist is an ordered list of songs for one date.</p>}
            <div className="setlist-list">
              {setlists.map((setlist) => (
                <button
                  key={setlist.id}
                  type="button"
                  className={shown?.id === setlist.id ? 'setlist-pick active' : 'setlist-pick'}
                  aria-current={shown?.id === setlist.id ? 'true' : undefined}
                  onClick={() => { setExtra(null); setOpenedId(setlist.id) }}
                >
                  <strong>{setlistName(setlist)}</strong>
                  <span className="meta">{[setlist.date, songCount(setlist.entries.length)].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {shown && (!narrow || opened) && (
          <SetlistDetail
            setlist={shown}
            songs={songs}
            narrow={narrow}
            rightHand={rightHand}
            extra={extra}
            onBack={() => { setExtra(null); setOpenedId(null) }}
            onRightHand={setRightHand}
            onChange={onChange}
            onDelete={(id) => { setOpenedId(null); onDelete(id) }}
            onExport={onExport}
            onStage={onStage}
            onExtra={setExtra}
          />
        )}
      </div>
    </div>
  )
}

function SetlistDetail({
  setlist,
  songs,
  narrow,
  rightHand,
  extra,
  onBack,
  onRightHand,
  onChange,
  onDelete,
  onExport,
  onStage,
  onExtra,
}: {
  setlist: Setlist
  songs: Song[]
  narrow: boolean
  rightHand: boolean
  extra: { index: number; field: 'capo' | 'notes' } | null
  onBack: () => void
  onRightHand: (value: boolean) => void
  onChange: (setlist: Setlist) => void
  onDelete: (id: string) => void
  onExport: (setlist: Setlist, rightHand: boolean) => void
  onStage: (setlist: Setlist) => void
  onExtra: (extra: { index: number; field: 'capo' | 'notes' } | null) => void
}) {
  return (
    <article className="setlist-detail">
      {narrow && <button className="text-button setlist-back" type="button" onClick={onBack}>‹ Setlists</button>}
      <div className="setlist-detail-head">
        <input className="field setlist-name" aria-label="Setlist name" placeholder="Setlist name" autoFocus={setlist.name === '' && setlist.entries.length === 0} value={setlist.name} onChange={(event) => onChange({ ...setlist, name: event.target.value })} />
        <input className="field setlist-date" aria-label="Setlist date" type="date" value={setlist.date} onChange={(event) => onChange({ ...setlist, date: event.target.value })} />
        <div className="setlist-actions">
          <button className="primary" type="button" onClick={() => onExport(setlist, rightHand)}>Export PDF</button>
          <Menu label="Setlist actions">
            <button type="button" role="menuitem" onClick={() => onStage(setlist)}>Stage</button>
            <label className="menu-check">
              <input type="checkbox" checked={rightHand} onChange={(event) => onRightHand(event.target.checked)} />
              Right-hand pages
            </label>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                if (!window.confirm(`Delete setlist “${setlistName(setlist)}”? This cannot be undone.`)) return
                onDelete(setlist.id)
              }}
            >
              Delete
            </button>
          </Menu>
        </div>
      </div>
      {setlist.entries.map((entry, index) => {
        const song = songs.find((item) => item.id === entry.songId)
        const title = song?.title ?? 'Missing song'
        const summary = entrySummary(entry)
        const openField = extra?.index === index ? extra.field : null
        return (
          <div className="setlist-song" key={`${entry.songId}-${index}`}>
            <span className="meta setlist-num">{index + 1}</span>
            <div className="setlist-song-title">
              <strong>{title}</strong>
              {summary && <span className="meta">{summary}</span>}
            </div>
            <select
              className="select setlist-key"
              aria-label={`Key for ${title}`}
              value={formatKey(entry.key ?? song?.originalKey ?? parseKey('C'))}
              onChange={(event) => onChange(updateEntry(setlist, index, { key: parseKey(event.target.value) }))}
            >
              {KEYS.map((key) => <option key={key}>{key}</option>)}
            </select>
            <Menu label={`Actions for ${title}`}>
              <button type="button" role="menuitem" onClick={() => onExtra({ index, field: 'capo' })}>Capo</button>
              <button type="button" role="menuitem" onClick={() => onExtra({ index, field: 'notes' })}>Notes</button>
              <button type="button" role="menuitem" disabled={index === 0} onClick={() => { onExtra(null); onChange(moveEntry(setlist, index, -1)) }}>Move up</button>
              <button type="button" role="menuitem" disabled={index === setlist.entries.length - 1} onClick={() => { onExtra(null); onChange(moveEntry(setlist, index, 1)) }}>Move down</button>
              <button type="button" role="menuitem" onClick={() => { onExtra(null); onChange({ ...setlist, entries: setlist.entries.filter((_, item) => item !== index) }) }}>Remove</button>
            </Menu>
            {openField === 'capo' && (
              <select
                className="select setlist-song-extra"
                aria-label={`Capo for ${title}`}
                value={entry.capo ?? 0}
                onChange={(event) => onChange(updateEntry(setlist, index, { capo: Number(event.target.value) }))}
              >
                {Array.from({ length: 12 }, (_, capo) => <option key={capo} value={capo}>{capo === 0 ? 'No capo' : `Capo ${capo}`}</option>)}
              </select>
            )}
            {openField === 'notes' && (
              <input
                className="field setlist-song-extra"
                aria-label="Notes"
                value={entry.notes ?? ''}
                placeholder="Notes"
                onChange={(event) => onChange(updateEntry(setlist, index, { notes: event.target.value }))}
              />
            )}
          </div>
        )
      })}
      <select
        className="select setlist-add"
        aria-label="Add a song"
        value=""
        onChange={(event) => { if (event.target.value) onChange({ ...setlist, entries: [...setlist.entries, { songId: event.target.value }] }) }}
      >
        <option value="">Add song…</option>
        {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
      </select>
    </article>
  )
}

function Menu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="menu-anchor" ref={anchor}>
      <button className="icon-button" type="button" aria-label={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>⋯</button>
      {open && (
        <div className="menu" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

function useNarrowPane(ref: RefObject<HTMLElement | null>, maxWidth: number): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const width = element.clientWidth
      if (width > 0) setNarrow(width < maxWidth)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, maxWidth])
  return narrow
}

function entrySummary(entry: SetlistEntry): string | null {
  const parts: string[] = []
  if ((entry.capo ?? 0) > 0) parts.push(`Capo ${entry.capo}`)
  if (entry.notes?.trim()) parts.push(entry.notes.trim())
  return parts.length > 0 ? parts.join(' · ') : null
}

export function setlistName(setlist: Setlist): string {
  return setlist.name.trim() || 'Untitled setlist'
}

function songCount(count: number): string {
  return count === 1 ? '1 song' : `${count} songs`
}

function updateEntry(setlist: Setlist, index: number, patch: Partial<SetlistEntry>): Setlist {
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
