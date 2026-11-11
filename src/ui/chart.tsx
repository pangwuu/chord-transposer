import { Fragment, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Copy, Ellipsis, GripVertical, StickyNote, Trash2, X } from 'lucide-react'
import { formatSymbol, nashville, type ChordSymbol, type Key } from '../domain/chord'
import { padCollisions, wrapLyricDisplay } from '../domain/line-layout'
import type { SectionKind, Song } from '../domain/song'
import { useCharCapacity } from './use-char-capacity'

export type NudgeHow = 'left' | 'right' | 'word-left' | 'word-right' | 'start' | 'end'

const SECTION_KINDS: { kind: SectionKind; label: string }[] = [
  { kind: 'intro', label: 'Intro' },
  { kind: 'verse', label: 'Verse' },
  { kind: 'prechorus', label: 'Pre-Chorus' },
  { kind: 'chorus', label: 'Chorus' },
  { kind: 'bridge', label: 'Bridge' },
  { kind: 'tag', label: 'Tag' },
  { kind: 'instrumental', label: 'Instrumental' },
  { kind: 'interlude', label: 'Interlude' },
  { kind: 'outro', label: 'Outro' },
]

export function symbolLabel(symbol: ChordSymbol, numbers: boolean, key: Key): string {
  return numbers ? nashville(symbol, key) : formatSymbol(symbol)
}

const lyricFontSize = (node: HTMLElement) => parseFloat(getComputedStyle(node).getPropertyValue('--fs-lyric')) || 15

export function Chart({
  song,
  shapeKey,
  numbers,
  selectedIds,
  readOnly,
  compact = false,
  onSelect,
  onAdd,
  onCheck,
  onRename,
  onDuplicate,
  onDeleteSection,
  onMoveSection,
  onPlaceSection,
  onAddSection,
  onAddNote,
  onEditNote,
  onRemoveLine,
  onAddBar,
  onNudge,
  onMove,
  onEdit,
  onDelete,
}: {
  song: Song
  shapeKey: Key
  numbers: boolean
  selectedIds: string[]
  readOnly: boolean
  /** Only the section actions that fix an import: rename and delete. */
  compact?: boolean
  onSelect: (id: string | null, shift?: boolean) => void
  onAdd: (lineId: string, index: number) => void
  onCheck: (lineId: string) => void
  onRename: (sectionId: string, label: string) => void
  onDuplicate: (sectionId: string) => void
  onDeleteSection: (sectionId: string) => void
  onMoveSection: (sectionId: string, direction: -1 | 1) => void
  onPlaceSection: (sectionId: string, index: number) => void
  onAddSection: (kind: SectionKind, label: string) => void
  onAddNote: (sectionId: string, text: string) => void
  onEditNote: (lineId: string, text: string) => void
  onRemoveLine: (lineId: string) => void
  onAddBar: (sectionId: string, lineId: string | null) => void
  onNudge: (how: NudgeHow) => void
  onMove: (id: string, lineId: string, index: number) => void
  onEdit: (id: string) => void
  onDelete: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const [caret, setCaret] = useState<{ lineId: string; index: number } | null>(null)
  const [sectionMenu, setSectionMenu] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const { ref, capacity } = useCharCapacity<HTMLDivElement>(lyricFontSize)
  return (
    <div ref={ref} className={dragging ? 'document dragging' : 'document'} onClick={() => onSelect(null)}>
      {song.sections.map((section, sectionIndex) => (
        <section className="section" key={section.id}>
          <div className="section-head">
            {!readOnly && !compact && (
              <button
                className="section-grip"
                type="button"
                aria-label={`Drag ${section.label}`}
                title="Drag to reorder"
                onPointerDown={(event) => { event.stopPropagation(); beginSectionDrag(event, section.id, onPlaceSection) }}
                onClick={(event) => event.stopPropagation()}
              >
                <GripVertical size={14} aria-hidden="true" />
              </button>
            )}
            <input key={`${section.id}:${section.label}`} className="section-label" size={Math.max(4, section.label.length)} aria-label={`${section.label} name`} defaultValue={section.label} disabled={readOnly} onBlur={(event) => onRename(section.id, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
            {!readOnly && compact && (
              <button
                className="section-menu-button section-delete"
                type="button"
                aria-label={`Delete ${section.label}`}
                title="Delete section"
                onClick={(event) => {
                  event.stopPropagation()
                  if (window.confirm(`Delete “${section.label}”? Its lines leave this import.`)) onDeleteSection(section.id)
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )}
            {!readOnly && !compact && (
              <span className="section-actions">
                <SectionMenu label={section.label} open={openMenu === section.id} onOpen={(open) => setOpenMenu(open ? section.id : null)}>
                  <button type="button" role="menuitem" disabled={sectionIndex === 0} onClick={() => onMoveSection(section.id, -1)}>
                    <ArrowUp size={14} aria-hidden="true" />Move up
                  </button>
                  <button type="button" role="menuitem" disabled={sectionIndex === song.sections.length - 1} onClick={() => onMoveSection(section.id, 1)}>
                    <ArrowDown size={14} aria-hidden="true" />Move down
                  </button>
                  <button type="button" role="menuitem" onClick={() => onDuplicate(section.id)}>
                    <Copy size={14} aria-hidden="true" />Duplicate
                  </button>
                  <button type="button" role="menuitem" onClick={() => setNoteDraft(section.id)}>
                    <StickyNote size={14} aria-hidden="true" />Add note
                  </button>
                  <button type="button" role="menuitem" className="danger" onClick={() => onDeleteSection(section.id)}>
                    <Trash2 size={14} aria-hidden="true" />Delete
                  </button>
                </SectionMenu>
              </span>
            )}
          </div>
          {section.lines.length === 0 && (
            <p className="hint">
              Empty section. <button type="button" className="text-button" onClick={(event) => { event.stopPropagation(); onAddBar(section.id, null) }}>Add chord</button>
            </p>
          )}
          {section.lines.map((line, lineNumber) => {
            if (line.type === 'comment') {
              return (
                <div className="note" key={line.id} onClick={(event) => event.stopPropagation()}>
                  <span className="note-label">Note</span>
                  <input
                    key={line.text}
                    className="note-text"
                    aria-label="Note"
                    defaultValue={line.text}
                    disabled={readOnly}
                    onBlur={(event) => onEditNote(line.id, event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                  />
                  {!readOnly && (
                    <button className="note-remove" type="button" aria-label="Remove note" onClick={() => onRemoveLine(line.id)}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )
            }
            if (line.type === 'bars') {
              return (
                <p className="bars" key={line.id}>
                  {line.items.map((item) =>
                    item.kind === 'bar' ? <span key={item.id}> | </span> : item.kind === 'rest' ? <span key={item.id}> {item.mark} </span> : (
                      <button key={item.id} type="button" className={chordClass(item.symbol, selectedIds.includes(item.id))} onClick={(event) => { event.stopPropagation(); onSelect(item.id, event.shiftKey) }} onDoubleClick={(event) => { event.stopPropagation(); onEdit(item.id) }}>
                        {symbolLabel(item.symbol, numbers, shapeKey)}
                      </button>
                    ),
                  )}
                  <button type="button" className="text-button" onClick={(event) => { event.stopPropagation(); onAddBar(section.id, line.id) }}>Add chord</button>
                </p>
              )
            }
            const ordered = [...line.chords].sort((a, b) => a.index - b.index)
            const padded = padCollisions(line.text, ordered.map((chord) => ({ label: symbolLabel(chord.symbol, numbers, shapeKey), index: chord.index })))
            const segments = wrapLyricDisplay(padded.text, padded.chords.map((placed, position) => ({ ...placed, id: ordered[position].id })), capacity, padded.origins)
            const selected = ordered.find((chord) => selectedIds.includes(chord.id))
            const showTools = selected && selectedIds[0] === selected.id && !readOnly && !dragging
            return (
              <div className="lyric-block" key={line.id} role="group" aria-label={`${section.label}, line ${lineNumber + 1}: ${line.text}`}>
                {showTools && (
                  <div className="toolbar" onClick={(event) => event.stopPropagation()}>
                    <button className="icon-button" type="button" aria-label="Previous word" onClick={() => onNudge('word-left')}>«</button>
                    <button className="icon-button" type="button" aria-label="Move left one letter" onClick={() => onNudge('left')}>‹</button>
                    <button className="icon-button" type="button" aria-label="Edit chord" onClick={() => onEdit(selected.id)}>{selectedIds.length > 1 ? `${selectedIds.length} chords` : symbolLabel(selected.symbol, numbers, shapeKey)}</button>
                    <button className="icon-button" type="button" aria-label="Move right one letter" onClick={() => onNudge('right')}>›</button>
                    <button className="icon-button" type="button" aria-label="Next word" onClick={() => onNudge('word-right')}>»</button>
                    <button className="icon-button" type="button" aria-label="Delete chord" onClick={onDelete}>Delete</button>
                  </div>
                )}
                {segments.map((segment, segmentIndex) => {
                  const origins = segment.origins ?? []
                  const holdsCaret = caret?.lineId === line.id && (origins.includes(caret.index) || segmentIndex === segments.length - 1)
                  return (
                    <Fragment key={segmentIndex}>
                      <div className="chord-row">
                        {segment.chords.map((placed) => {
                          const chord = ordered.find((item) => item.id === placed.id)
                          if (!chord) return null
                          return (
                            <button
                              key={chord.id}
                              type="button"
                              className={chordClass(chord.symbol, selectedIds.includes(chord.id))}
                              style={{ left: `${placed.index}ch` }}
                              aria-label={`Chord ${symbolLabel(chord.symbol, false, shapeKey)} over "${wordAt(line.text, chord.index)}", ${section.label} line ${lineNumber + 1}`}
                              onClick={(event) => { event.stopPropagation(); onSelect(chord.id, event.shiftKey) }}
                              onDoubleClick={(event) => { event.stopPropagation(); onEdit(chord.id) }}
                              onPointerDown={(event) => beginDrag(event, chord.id, onMove, () => onEdit(chord.id), setDragging, setCaret)}
                            >
                              {symbolLabel(chord.symbol, numbers, shapeKey)}
                            </button>
                          )
                        })}
                      </div>
                      <div className="lyric-row" data-line={line.id} data-origins={origins.join(',')}>
                        {holdsCaret && caret && <span className="caret" style={{ left: `${visualColumn(origins, caret.index)}ch` }} />}
{segment.text.split('').map((character, index) => (
                    <button
                      key={`${line.id}-${index}`}
                      type="button"
                      className="letter"
                      aria-label={character === ' ' ? 'Add a chord on the space' : `Add a chord on ${character}`}
                      disabled={readOnly || origins[index] < 0}
                      onClick={(event) => { event.stopPropagation(); if (origins[index] >= 0) onAdd(line.id, origins[index]) }}
                    >
                      {character === ' ' ? '\u00a0' : character}
                    </button>
                  ))}
                  {segment.text.length === 0 && !readOnly && <button type="button" className="letter" onClick={(event) => { event.stopPropagation(); onAdd(line.id, 0) }}>+ chord</button>}
                </div>
                    </Fragment>
                  )
                })}
                {line.needsCheck && (
                  <p className="check-line">Chords on this line moved with the words. <button type="button" onClick={() => onCheck(line.id)}>Checked</button></p>
                )}
              </div>
            )
          })}
          {noteDraft === section.id && (
            <form className="note note-draft" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); const text = String(new FormData(event.currentTarget).get('note') ?? ''); onAddNote(section.id, text); setNoteDraft(null) }}>
              <span className="note-label">Note</span>
              <input
                className="note-text"
                name="note"
                aria-label="New note"
                placeholder="Quiet, then build"
                autoFocus
                onBlur={(event) => { if (!event.target.value.trim()) setNoteDraft(null) }}
                onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setNoteDraft(null) } }}
              />
            </form>
          )}
        </section>
      ))}
      {!readOnly && !compact && (
        <div className="add-section">
          <button className="outline" type="button" aria-expanded={sectionMenu} onClick={(event) => { event.stopPropagation(); setSectionMenu((open) => !open) }}>+ Add section</button>
          {sectionMenu && (
            <div className="menu" role="menu" onClick={(event) => event.stopPropagation()}>
              {SECTION_KINDS.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const count = song.sections.filter((section) => section.kind === item.kind).length + 1
                    const label = item.kind === 'verse' || item.kind === 'chorus' ? `${item.label} ${count}` : item.label
                    onAddSection(item.kind, label)
                    setSectionMenu(false)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SectionMenu({ label, open, onOpen, children }: { label: string; open: boolean; onOpen: (open: boolean) => void; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) onOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpen])
  return (
    <span className="section-menu" ref={anchor} onClick={(event) => event.stopPropagation()}>
      <button
        className="section-menu-button"
        type="button"
        aria-label={`${label} actions`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpen(!open)}
      >
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      {open && (
        <span className="menu section-menu-list" role="menu" onClick={() => onOpen(false)}>
          {children}
        </span>
      )}
    </span>
  )
}

function beginSectionDrag(
  event: ReactPointerEvent<HTMLButtonElement>,
  id: string,
  onPlace: (sectionId: string, index: number) => void,
) {
  if (event.button !== 0) return
  const startY = event.clientY
  let moved = false
  let index = 0
  const target = event.currentTarget
  target.setPointerCapture(event.pointerId)
  const move = (ev: PointerEvent) => {
    if (!moved && Math.abs(ev.clientY - startY) < 4) return
    moved = true
    const sections = [...document.querySelectorAll<HTMLElement>('.section')]
    const found = sections.findIndex((section) => ev.clientY < section.getBoundingClientRect().top + section.getBoundingClientRect().height / 2)
    index = found < 0 ? Math.max(0, sections.length - 1) : found
  }
  const up = () => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    if (moved) onPlace(id, index)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
}

function beginDrag(
  event: ReactPointerEvent<HTMLButtonElement>,
  id: string,
  onMove: (id: string, lineId: string, index: number) => void,
  onHold: () => void,
  setDragging: (dragging: boolean) => void,
  setCaret: (caret: { lineId: string; index: number } | null) => void,
) {
  if (event.button !== 0) return
  const startX = event.clientX
  const startY = event.clientY
  let moved = false
  let drop: { lineId: string; index: number } | null = null
  const target = event.currentTarget
  target.setPointerCapture(event.pointerId)
  const hold = window.setTimeout(() => { if (!moved) onHold() }, 500)
  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
    moved = true
    window.clearTimeout(hold)
    document.documentElement.classList.add('chord-dragging')
    setDragging(true)
    drop = dropAt(ev.clientX, ev.clientY)
    setCaret(drop)
  }
  const up = () => {
    window.clearTimeout(hold)
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    document.documentElement.classList.remove('chord-dragging')
    setDragging(false)
    setCaret(null)
    if (moved && drop) {
      onMove(id, drop.lineId, drop.index)
      const stopClick = (click: Event) => {
        click.preventDefault()
        click.stopPropagation()
      }
      window.addEventListener('click', stopClick, { capture: true, once: true })
    }
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
}

function dropAt(clientX: number, clientY: number): { lineId: string; index: number } | null {
  const hit = document.elementFromPoint(clientX, clientY)
  const row = hit?.closest<HTMLElement>('.lyric-row')
  if (!row?.dataset.line) return null
  const origins = (row.dataset.origins ?? '').split(',').filter((item) => item.length > 0).map(Number)
  if (origins.length === 0) return { lineId: row.dataset.line, index: 0 }
  const letters = [...row.querySelectorAll('button.letter')]
  const direct = hit?.closest('button.letter')
  let col = direct ? letters.indexOf(direct) : -1
  if (col < 0) {
    const rowRect = row.getBoundingClientRect()
    const first = letters[0]?.getBoundingClientRect()
    const width = first && first.width > 0 ? first.width : rowRect.width / origins.length
    const left = first?.left ?? rowRect.left
    col = Math.floor((clientX - left) / Math.max(width, 1))
  }
  col = Math.min(origins.length - 1, Math.max(0, col))
  let index = origins[col]
  if (index < 0) index = [...origins.slice(0, col)].reverse().find((item) => item >= 0) ?? origins.find((item) => item >= 0) ?? 0
  return { lineId: row.dataset.line, index }
}

function visualColumn(origins: number[], index: number): number {
  const at = origins.indexOf(index)
  return at >= 0 ? at : origins.length
}

function chordClass(symbol: ChordSymbol, selected: boolean): string {
  return ['chord', selected ? 'selected' : '', symbol.kind === 'invalid' ? 'invalid' : ''].filter(Boolean).join(' ')
}

function wordAt(text: string, index: number): string {
  if (index >= text.length) return 'the end'
  const match = text.slice(index).match(/^\s*(\S+)/)
  return match?.[1] ?? 'the line'
}
