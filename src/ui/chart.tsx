import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { formatSymbol, nashville, type ChordSymbol, type Key } from '../domain/chord'
import { padCollisions } from '../domain/line-layout'
import type { SectionKind, Song } from '../domain/song'

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

export function Chart({
  song,
  shapeKey,
  numbers,
  selectedIds,
  readOnly,
  onSelect,
  onAdd,
  onLyric,
  onCheck,
  onRename,
  onDuplicate,
  onDeleteSection,
  onMoveSection,
  onPlaceSection,
  onAddSection,
  onComment,
  onBars,
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
  onSelect: (id: string | null, shift?: boolean) => void
  onAdd: (lineId: string, index: number) => void
  onLyric: (lineId: string, text: string) => void
  onCheck: (lineId: string) => void
  onRename: (sectionId: string, label: string) => void
  onDuplicate: (sectionId: string) => void
  onDeleteSection: (sectionId: string) => void
  onMoveSection: (sectionId: string, direction: -1 | 1) => void
  onPlaceSection: (sectionId: string, index: number) => void
  onAddSection: (kind: SectionKind, label: string) => void
  onComment: (sectionId: string, text: string) => void
  onBars: (sectionId: string, text: string) => void
  onNudge: (how: NudgeHow) => void
  onMove: (id: string, lineId: string, index: number) => void
  onEdit: (id: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [caret, setCaret] = useState<{ lineId: string; index: number } | null>(null)
  const [sectionMenu, setSectionMenu] = useState(false)
  const [lineDraft, setLineDraft] = useState<{ id: string; kind: 'comment' | 'bars' } | null>(null)
  return (
    <div className={dragging ? 'document dragging' : 'document'} onClick={() => onSelect(null)}>
      {song.sections.map((section) => (
        <section className="section" key={section.id}>
          <div className="section-head">
            <input key={`${section.id}:${section.label}`} className="section-label" aria-label={`${section.label} name`} defaultValue={section.label} disabled={readOnly} onBlur={(event) => onRename(section.id, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
            {!readOnly && (
              <span className="section-actions">
                <button className="text-button" type="button" aria-label={`Drag ${section.label}`} onPointerDown={(event) => { event.stopPropagation(); beginSectionDrag(event, section.id, onPlaceSection) }}>Drag</button>
                <button className="text-button" type="button" aria-label={`Move ${section.label} up`} onClick={() => onMoveSection(section.id, -1)}>Up</button>
                <button className="text-button" type="button" aria-label={`Move ${section.label} down`} onClick={() => onMoveSection(section.id, 1)}>Down</button>
                <button className="text-button" type="button" onClick={() => onDuplicate(section.id)}>Duplicate</button>
                <button className="text-button" type="button" onClick={() => onDeleteSection(section.id)}>Delete</button>
                <button className="text-button" type="button" onClick={() => setLineDraft({ id: section.id, kind: 'comment' })}>Comment</button>
                <button className="text-button" type="button" onClick={() => setLineDraft({ id: section.id, kind: 'bars' })}>Bars</button>
              </span>
            )}
          </div>
          {lineDraft?.id === section.id && (
            <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const text = String(data.get('line') ?? ''); if (lineDraft.kind === 'comment') onComment(section.id, text); else onBars(section.id, text); setLineDraft(null) }}>
              <input className="field" name="line" aria-label={lineDraft.kind === 'comment' ? 'Comment' : 'Bar line'} placeholder={lineDraft.kind === 'comment' ? 'Repeat ×2' : '| C - - - | F/A - - - |'} autoFocus />
            </form>
          )}
          {section.lines.length === 0 && <p className="hint">Empty section. Add a line</p>}
          {section.lines.map((line, lineNumber) => {
            if (line.type === 'comment') return <p className="comment" key={line.id}>{line.text}</p>
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
                </p>
              )
            }
            const ordered = [...line.chords].sort((a, b) => a.index - b.index)
            const padded = padCollisions(line.text, ordered.map((chord) => ({ label: symbolLabel(chord.symbol, numbers, shapeKey), index: chord.index })))
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
                <div className="chord-row">
                  {ordered.map((chord) => {
                    const placed = padded.chords[ordered.indexOf(chord)]
                    return (
                      <button
                        key={chord.id}
                        type="button"
                        className={chordClass(chord.symbol, selectedIds.includes(chord.id))}
                        style={{ left: `${placed?.index ?? chord.index}ch` }}
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
                <div className="lyric-row" data-line={line.id} data-origins={padded.origins.join(',')}>
                  {caret?.lineId === line.id && <span className="caret" style={{ left: `${visualColumn(padded.origins, caret.index)}ch` }} />}
                  {padded.text.split('').map((character, index) => (
                    <button
                      key={`${line.id}-${index}`}
                      type="button"
                      className="letter"
                      disabled={readOnly || padded.origins[index] < 0}
                      onClick={(event) => { event.stopPropagation(); if (padded.origins[index] >= 0) onAdd(line.id, padded.origins[index]) }}
                    >
                      {character === ' ' ? '\u00a0' : character}
                    </button>
                  ))}
                  {padded.text.length === 0 && !readOnly && <button type="button" className="letter" onClick={(event) => { event.stopPropagation(); onAdd(line.id, 0) }}>+ chord</button>}
                </div>
                {line.needsCheck && (
                  <p className="check-line">Chords on this line moved with the words. <button type="button" onClick={() => onCheck(line.id)}>Checked</button></p>
                )}
                {!readOnly && editing !== line.id && <button className="text-button" type="button" onClick={() => setEditing(line.id)}>Edit lyric</button>}
                {editing === line.id && (
                  <input className="lyric-edit" aria-label="Lyric line" defaultValue={line.text} onBlur={(event) => { onLyric(line.id, event.target.value); setEditing(null) }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
                )}
              </div>
            )
          })}
        </section>
      ))}
      {!readOnly && (
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
  const rect = row.getBoundingClientRect()
  const width = rect.width / origins.length
  const col = Math.min(origins.length - 1, Math.max(0, Math.floor((clientX - rect.left) / Math.max(width, 1))))
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
