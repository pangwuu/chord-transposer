import { useEffect, useState } from 'react'
import { formatChord, formatNote, formatSymbol, nashville, parseChord, suggestionsFor, type ChordSymbol, type Key, type Letter } from '../domain/chord'
import { chordsUsed, findPlacement, type Song } from '../domain/song'
import type { NudgeHow } from './chart'

const ROOTS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const QUALITIES = ['', 'm', '7', 'maj7', 'm7', 'sus', 'sus2', 'sus4', '2', 'add9', '5', '6', 'dim', 'aug', 'm7b5', '7sus4']

export function Inspector({
  song,
  shapeKey,
  selectedId,
  concertLabel,
  focusSignal,
  onText,
  onReplace,
  onDelete,
  onClose,
  phone = false,
  onNudge,
  previewShown = false,
  onTogglePreview,
}: {
  song: Song
  shapeKey: Key
  selectedId: string | null
  concertLabel: string | null
  focusSignal: number
  onText: (text: string) => void
  onReplace: (text: string) => void
  onDelete: () => void
  onClose: () => void
  phone?: boolean
  onNudge?: (how: NudgeHow) => void
  previewShown?: boolean
  onTogglePreview?: () => void
}) {
  const [advanced, setAdvanced] = useState(false)
  useEffect(() => setAdvanced(false), [selectedId])
  const found = selectedId ? findPlacement(song, selectedId) : null
  const selected = chordSymbol(found)
  const label = selected ? formatSymbol(selected) : ''
  const [draft, setDraft] = useState(label)
  const [replacement, setReplacement] = useState('')
  useEffect(() => setDraft(label), [selectedId, label])
  useEffect(() => {
    if (focusSignal === 0) return
    const field = document.getElementById('chord-text')
    if (field instanceof HTMLInputElement) {
      field.focus()
      field.select()
    }
  }, [focusSignal])

  const used = chordsUsed(song)
  const suggestions = suggestionsFor(shapeKey)
  if (!selected || !found) return null

  const parsed = parseChord(draft)
  const line = found.line.type === 'lyric' ? found.line : null
  const where = line ? `${found.section.label} · over “${wordAt(line.text, line.chords[found.index]?.index ?? 0)}”` : found.section.label
  const current = selected.kind === 'chord' ? selected.chord : null
  const bassNotes = suggestions.slice(0, 7).map((item) => {
    const note = parseChord(item.symbol)
    return note.kind === 'chord' ? formatNote(note.chord.root) : item.symbol
  })

  const inKey = suggestions.slice(0, 7)
  const outOfKey = suggestions.slice(7)
  const suggestionTiles = (items: typeof suggestions) => items.map((item) => (
    <button key={item.numeral + item.symbol} type="button" className="tile suggest" aria-pressed={item.symbol === label} onClick={() => onText(item.symbol)}>
      {item.symbol} {item.numeral}
    </button>
  ))
  const position = <p className="meta">{where}</p>
  const builder = (
    <>
      <h3>Build a chord</h3>
      <div className="tiles" role="group" aria-label="Root">
        {ROOTS.map((letter) => (
          <button key={letter} type="button" className="tile" aria-pressed={current?.root.letter === letter} onClick={() => onText(rewrite(selected, { letter }))}>
            {letter}
          </button>
        ))}
      </div>
      <div className="tiles" role="group" aria-label="Accidental">
        <button type="button" className="tile" aria-pressed={current?.root.accidental === 'b'} onClick={() => current && onText(rewrite(selected, { accidental: 'b' }))}>♭</button>
        <button type="button" className="tile" aria-pressed={current?.root.accidental === ''} onClick={() => current && onText(rewrite(selected, { accidental: '' }))}>♮</button>
        <button type="button" className="tile" aria-pressed={current?.root.accidental === '#'} onClick={() => current && onText(rewrite(selected, { accidental: '#' }))}>♯</button>
      </div>
      <div className="tiles" role="group" aria-label="Quality">
        {QUALITIES.map((quality) => (
          <button key={quality || 'maj'} type="button" className="tile" aria-pressed={current?.quality === quality} onClick={() => current && onText(rewrite(selected, { quality }))}>
            {quality || 'maj'}
          </button>
        ))}
      </div>
      <label className="hint" htmlFor="bass">Bass</label>
      <select id="bass" className="select" aria-label="Bass note" value={current?.bass ? formatNote(current.bass) : ''} onChange={(event) => current && onText(rewrite(selected, { bass: event.target.value }))}>
        <option value="">None</option>
        {bassNotes.map((note) => <option key={note} value={note}>{note}</option>)}
      </select>
    </>
  )
  const replaceRow = (
    <form className="replace-row" onSubmit={(event) => { event.preventDefault(); if (replacement.trim()) onReplace(replacement.trim()) }}>
      <input className="field" aria-label="Replace every instance with" value={replacement} placeholder="C2" onChange={(event) => setReplacement(event.target.value)} />
      <button className="outline" type="submit">Replace every {label}</button>
    </form>
  )

  return (
    <aside className={phone ? 'inspector is-sheet' : 'inspector'}>
      <div className="row-meta">
        <h2>Chord</h2>
        {phone && <button className="text-button danger" type="button" onClick={onDelete}>Delete</button>}
        <button className="text-button" type="button" aria-label="Close chord" onClick={onClose}>×</button>
      </div>
      {!phone && onTogglePreview && (
        <button className="text-button preview-toggle" type="button" aria-pressed={previewShown} onClick={onTogglePreview}>
          {previewShown ? 'Hide PDF preview' : 'Show PDF preview'}
        </button>
      )}
      <p className="big-chord">{label}</p>
      <p className="meta">{nashville(selected, shapeKey)} in this key{concertLabel ? ` · sounds as ${concertLabel}` : ''}</p>
      {phone && onNudge && (
        <div className="sheet-nudges" role="group" aria-label="Move chord">
          <button className="outline" type="button" aria-label="Previous word" onClick={() => onNudge('word-left')}>‹‹</button>
          <button className="outline" type="button" aria-label="Move left one letter" onClick={() => onNudge('left')}>‹</button>
          <button className="outline" type="button" aria-label="Move right one letter" onClick={() => onNudge('right')}>›</button>
          <button className="outline" type="button" aria-label="Next word" onClick={() => onNudge('word-right')}>››</button>
        </div>
      )}
      <label className="hint" htmlFor="chord-text">Chord</label>
      <input
        id="chord-text"
        className={parsed.kind === 'invalid' ? 'field invalid' : 'field'}
        aria-label="Chord name"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onText(draft.trim())
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setDraft(label)
          }
        }}
      />
      <p className="hint">{parsed.kind === 'invalid' ? 'Not a recognised chord. Enter keeps it as typed.' : 'Enter to apply · Esc to cancel'}</p>
      {!phone && position}
      <h3>In this key</h3>
      <div className="tiles">{suggestionTiles(phone ? inKey : suggestions)}</div>
      <h3>Used in this song</h3>
      <div className="tiles">
        {used.map((item) => (
          <button key={item.label} type="button" className="tile suggest" aria-pressed={item.label === label} onClick={() => onText(item.label)}>
            {item.label}
          </button>
        ))}
      </div>
      {phone ? (
        <>
          <button className="sheet-advanced" type="button" aria-expanded={advanced} onClick={() => setAdvanced((open) => !open)}>Advanced</button>
          {advanced && (
            <div className="sheet-advanced-body">
              {builder}
              <h3>Out of key</h3>
              <div className="tiles">{suggestionTiles(outOfKey)}</div>
              {replaceRow}
              {position}
            </div>
          )}
        </>
      ) : (
        <>
          {builder}
          {replaceRow}
          <button className="text-button" type="button" onClick={onDelete}>Delete chord</button>
        </>
      )}
    </aside>
  )
}

function chordSymbol(found: ReturnType<typeof findPlacement>): ChordSymbol | null {
  if (!found) return null
  if (found.line.type === 'lyric') return found.line.chords[found.index]?.symbol ?? null
  if (found.line.type === 'bars') {
    const item = found.line.items[found.index]
    return item && item.kind === 'chord' ? item.symbol : null
  }
  return null
}

function rewrite(symbol: ChordSymbol, change: { letter?: Letter; accidental?: '' | 'b' | '#'; quality?: string; bass?: string }): string {
  if (symbol.kind !== 'chord') return formatSymbol(symbol)
  const root = {
    letter: change.letter ?? symbol.chord.root.letter,
    accidental: change.accidental ?? symbol.chord.root.accidental,
  }
  let bass = symbol.chord.bass
  if (change.bass !== undefined) {
    const parsed = change.bass ? parseChord(change.bass) : null
    bass = parsed && parsed.kind === 'chord' ? parsed.chord.root : undefined
  }
  return formatChord({ root, quality: change.quality ?? symbol.chord.quality, bass, raw: '' })
}

function wordAt(text: string, index: number): string {
  const match = text.slice(index).match(/^\s*(\S+)/)
  return match?.[1] ?? 'the end'
}
