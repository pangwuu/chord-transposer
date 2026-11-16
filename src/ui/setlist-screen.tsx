import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Guitar } from 'lucide-react'
import { formatKey, parseKey } from '../domain/chord'
import type { Setlist, SetlistEntry } from '../domain/library-types'
import { lastPlayed, lastPlayedLabel, todayDate } from '../domain/setlist'
import { DEFAULT_SONG_SORT, findSongs, type Song, type SongSort } from '../domain/song'

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
  onProject,
  onShare,
  onDownload,
  onImport,
  onCopyOrder,
  onShareOrder,
  sort = DEFAULT_SONG_SORT,
  today = todayDate(),
  openedId: givenId,
  onOpen,
}: {
  songs: Song[]
  setlists: Setlist[]
  /** The order chosen for the song list; the "Add song" box lists songs the same way. */
  sort?: SongSort
  /** Today as `YYYY-MM-DD`, for the "last played" hints. */
  today?: string
  onCopyOrder?: (setlist: Setlist) => void
  /** Only given where the device has a share sheet. */
  onShareOrder?: (setlist: Setlist) => void
  onShare: (setlist: Setlist) => void
  onDownload: (setlist: Setlist) => void
  onImport: (file: File) => void
  /** With `onOpen`, the caller holds which setlist is open. Without it, the screen does. */
  openedId?: string | null
  onOpen?: (id: string | null) => void
  onCreate: () => void
  onChange: (setlist: Setlist) => void
  onDelete: (id: string) => void
  onExport: (setlist: Setlist) => void
  onStage: (setlist: Setlist) => void
  onProject: (setlist: Setlist) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const narrow = useNarrowPane(rootRef, NARROW_PANE)
  const [localId, setLocalId] = useState<string | null>(null)
  const openedId = onOpen ? (givenId ?? null) : localId
  const setOpenedId = onOpen ?? setLocalId
  const fileInput = useRef<HTMLInputElement>(null)
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
    else if (openedId && !ids.includes(openedId)) setOpenedId(null)
  }, [setlists, openedId])

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
              <button className="outline" type="button" onClick={() => fileInput.current?.click()}>Import file</button>
              <input
                ref={fileInput}
                hidden
                aria-label="Import setlist file"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) onImport(file)
                }}
              />
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
            setlists={setlists}
            sort={sort}
            today={today}
            onCopyOrder={onCopyOrder}
            onShareOrder={onShareOrder}
            narrow={narrow}
            extra={extra}
            onBack={() => { setExtra(null); setOpenedId(null) }}
            onChange={onChange}
            onDelete={(id) => { setOpenedId(null); onDelete(id) }}
            onExport={onExport}
            onStage={onStage}
            onProject={onProject}
            onShare={onShare}
            onDownload={onDownload}
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
  extra,
  onBack,
  onChange,
  onDelete,
  onExport,
  onStage,
  onProject,
  onShare,
  onDownload,
  onExtra,
  setlists,
  sort,
  today,
  onCopyOrder,
  onShareOrder,
}: {
  setlists: Setlist[]
  sort: SongSort
  today: string
  onCopyOrder?: (setlist: Setlist) => void
  onShareOrder?: (setlist: Setlist) => void
  onShare: (setlist: Setlist) => void
  onDownload: (setlist: Setlist) => void
  setlist: Setlist
  songs: Song[]
  narrow: boolean
  extra: { index: number; field: 'capo' | 'notes' } | null
  onBack: () => void
  onChange: (setlist: Setlist) => void
  onDelete: (id: string) => void
  onExport: (setlist: Setlist) => void
  onStage: (setlist: Setlist) => void
  onProject: (setlist: Setlist) => void
  onExtra: (extra: { index: number; field: 'capo' | 'notes' } | null) => void
}) {
  return (
    <article className="setlist-detail">
      {narrow && <button className="text-button setlist-back" type="button" onClick={onBack}>‹ Setlists</button>}
      <div className="setlist-detail-head">
        <input className="field setlist-name" aria-label="Setlist name" placeholder="Setlist name" autoFocus={setlist.name === '' && setlist.entries.length === 0} value={setlist.name} onChange={(event) => onChange({ ...setlist, name: event.target.value })} />
        <input className="field setlist-date" aria-label="Setlist date" type="date" value={setlist.date} onChange={(event) => onChange({ ...setlist, date: event.target.value })} />
        <div className="setlist-actions">
          <button className="outline setlist-perform" type="button" disabled={setlist.entries.length === 0} onClick={() => onStage(setlist)}>
            <Guitar size={16} strokeWidth={1.75} aria-hidden="true" />Perform
          </button>
          <button className="primary" type="button" onClick={() => onExport(setlist)}>Export PDF</button>
          <Menu label="Setlist actions">
            <button type="button" role="menuitem" disabled={setlist.entries.length === 0} onClick={() => onProject(setlist)}>Projector view</button>
            <button type="button" role="menuitem" disabled={setlist.entries.length === 0} onClick={() => onShare(setlist)}>Copy share link</button>
            <button type="button" role="menuitem" disabled={setlist.entries.length === 0} onClick={() => onDownload(setlist)}>Download file</button>
            {onCopyOrder && <button type="button" role="menuitem" disabled={setlist.entries.length === 0} onClick={() => onCopyOrder(setlist)}>Copy running order</button>}
            {onShareOrder && <button type="button" role="menuitem" disabled={setlist.entries.length === 0} onClick={() => onShareOrder(setlist)}>Share running order</button>}
            <button type="button" role="menuitem" onClick={() => onDelete(setlist.id)}>Delete</button>
          </Menu>
        </div>
      </div>
      <div className="setlist-songs">
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
      <div className="setlist-add-row">
        <AddSongBox
          songs={songs}
          sort={sort}
          sheet={narrow}
          inSet={new Set(setlist.entries.map((entry) => entry.songId))}
          hint={(song) => lastPlayedLabel(lastPlayed(song, setlists, today), today)}
          onAdd={(song) => onChange({ ...setlist, entries: [...setlist.entries, { songId: song.id }] })}
        />
      </div>
      </div>
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

const ADD_SONG_LIMIT = 300

/**
 * A search box that finds songs by title, artist or lyrics, so a big library is never one long dropdown.
 * Focused with nothing typed, it lists the whole library in the song list's order. On a narrow screen the
 * list opens as a sheet from the top of the screen, sized to what the on-screen keyboard leaves visible.
 */
function AddSongBox({
  songs,
  sort,
  sheet,
  inSet,
  hint,
  onAdd,
}: {
  songs: Song[]
  sort: SongSort
  sheet: boolean
  inSet: Set<string>
  hint: (song: Song) => string
  onAdd: (song: Song) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const matches = open ? findSongs(songs, query, sort).slice(0, ADD_SONG_LIMIT) : []
  const highlighted = Math.min(active, matches.length - 1)
  const asSheet = sheet && open

  useEffect(() => {
    const node = box.current
    const viewport = window.visualViewport
    if (!asSheet || !node || !viewport) return
    const fit = () => { node.style.height = `${viewport.height}px`; node.style.top = `${viewport.offsetTop}px` }
    fit()
    viewport.addEventListener('resize', fit)
    viewport.addEventListener('scroll', fit)
    return () => {
      viewport.removeEventListener('resize', fit)
      viewport.removeEventListener('scroll', fit)
      node.style.height = ''
      node.style.top = ''
    }
  }, [asSheet])

  useEffect(() => {
    if (!open) return
    document.getElementById(`add-song-${matches[highlighted]?.id}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [highlighted, open])

  function add(song: Song) {
    onAdd(song)
    setQuery('')
    setActive(0)
    input.current?.focus()
  }

  function close() {
    setOpen(false)
    setQuery('')
    setActive(0)
  }

  return (
    <div ref={box} className={asSheet ? 'add-song is-sheet' : 'add-song'} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
      <div className="add-song-bar">
        <input
          ref={input}
          className="field setlist-add"
          role="combobox"
          aria-label="Add a song"
          aria-expanded={matches.length > 0}
          aria-controls="add-song-options"
          aria-autocomplete="list"
          aria-activedescendant={matches[highlighted] ? `add-song-${matches[highlighted].id}` : undefined}
          placeholder="Add song…"
          autoComplete="off"
          value={query}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true) }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(Math.min(matches.length - 1, highlighted + 1)) }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(0, highlighted - 1)) }
            else if (event.key === 'Enter' && matches[highlighted]) { event.preventDefault(); add(matches[highlighted]) }
            else if (event.key === 'Escape') { event.stopPropagation(); close() }
          }}
        />
        {asSheet && <button className="text-button" type="button" onClick={() => { close(); input.current?.blur() }}>Done</button>}
      </div>
      {matches.length > 0 && (
        <ul className="add-song-options" id="add-song-options" role="listbox" aria-label="Songs">
          {matches.map((song, index) => (
            <li
              key={song.id}
              id={`add-song-${song.id}`}
              role="option"
              aria-selected={index === highlighted}
              className={index === highlighted ? 'add-song-option active' : 'add-song-option'}
              onPointerDown={(event) => event.preventDefault()}
              onPointerEnter={() => setActive(index)}
              onClick={() => add(song)}
            >
              <span className="add-song-title">
                <strong>{song.title}</strong>
                {inSet.has(song.id) && <span className="in-set">In set</span>}
              </span>
              <span className="meta">{[song.artist, formatKey(song.originalKey)].filter(Boolean).join(' · ')}</span>
              <span className="meta last-played">{hint(song)}</span>
            </li>
          ))}
        </ul>
      )}
      {open && matches.length === 0 && query.trim() !== '' && <p className="add-song-none" role="status">No songs match.</p>}
    </div>
  )
}
