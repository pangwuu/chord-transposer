import { useState } from 'react'
import { formatSymbol, nashville, type Key } from '../domain/chord'
import { padCollisions } from '../domain/line-layout'
import type { ChordSymbol, Song } from '../domain/song'

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
  onAddSection,
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
  onAddSection: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <div className="document" onClick={() => onSelect(null)}>
      {song.sections.map((section) => (
        <section className="section" key={section.id}>
          <div className="section-head">
            <input className="section-label" aria-label={`${section.label} name`} defaultValue={section.label} disabled={readOnly} onBlur={(event) => onRename(section.id, event.target.value)} />
            {!readOnly && (
              <>
                <button className="text-button" type="button" onClick={() => onDuplicate(section.id)}>Duplicate</button>
                <button className="text-button" type="button" onClick={() => onDeleteSection(section.id)}>Delete</button>
              </>
            )}
          </div>
          {section.lines.length === 0 && <p className="hint">Empty section. Add a line</p>}
          {section.lines.map((line, lineNumber) => {
            if (line.type === 'comment') return <p className="comment" key={line.id}>{line.text}</p>
            if (line.type === 'bars') {
              return (
                <p className="bars" key={line.id}>
                  {line.items.map((item) =>
                    item.kind === 'bar' ? <span key={item.id}> | </span> : item.kind === 'rest' ? <span key={item.id}> {item.mark} </span> : (
                      <button key={item.id} type="button" className={chordClass(item.symbol, selectedIds.includes(item.id))} onClick={(event) => { event.stopPropagation(); onSelect(item.id, event.shiftKey) }}>
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
            return (
              <div className="lyric-block" key={line.id} role="group" aria-label={`${section.label}, line ${lineNumber + 1}: ${line.text}`}>
                {selected && !readOnly && (
                  <div className="toolbar" style={{ left: `${padded.chords.find((chord) => chord.label === symbolLabel(selected.symbol, numbers, shapeKey))?.index ?? selected.index}ch` }}>
                    <span>{symbolLabel(selected.symbol, numbers, shapeKey)}</span>
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
                      >
                        {symbolLabel(chord.symbol, numbers, shapeKey)}
                      </button>
                    )
                  })}
                </div>
                <div className="lyric-row">
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
      {!readOnly && <button className="outline" type="button" onClick={onAddSection}>+ Add section</button>}
    </div>
  )
}

function chordClass(symbol: ChordSymbol, selected: boolean): string {
  return ['chord', selected ? 'selected' : '', symbol.kind === 'invalid' ? 'invalid' : ''].filter(Boolean).join(' ')
}

function wordAt(text: string, index: number): string {
  if (index >= text.length) return 'the end'
  const match = text.slice(index).match(/^\s*(\S+)/)
  return match?.[1] ?? 'the line'
}
