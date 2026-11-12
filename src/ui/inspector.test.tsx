import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseChord, parseKey } from '../domain/chord'
import { emptySong, idSequence } from '../domain/song'
import { Inspector } from './inspector'

afterEach(() => cleanup())

function song() {
  const ids = idSequence('insp')
  const value = emptySong({ title: 'T', artist: '', originalKey: parseKey('G'), tempo: 80, timeSignature: '4/4' }, ids)
  value.sections = [{ id: 's1', kind: 'verse', label: 'Verse 1', lines: [{ id: 'l1', type: 'lyric', text: 'Amazing grace', needsCheck: false, chords: [
    { id: 'c1', index: 0, symbol: parseChord('G') },
    { id: 'c2', index: 8, symbol: parseChord('C') },
  ] }] }]
  return value
}

function renderInspector(props: { phone?: boolean; selectedId?: string; onNudge?: (how: string) => void } = {}) {
  const value = song()
  return render(
    <Inspector song={value} shapeKey={parseKey('G')} selectedId={props.selectedId ?? 'c1'} concertLabel={null} focusSignal={0}
      phone={props.phone} onNudge={props.onNudge} onText={() => {}} onReplace={() => {}} onDelete={() => {}} onClose={() => {}} />,
  )
}

describe('Inspector suggestions', () => {
  it('marks the chord being edited with the accent in the suggestion rows only', () => {
    renderInspector()
    const current = document.querySelectorAll('.tile.suggest[aria-pressed="true"]')
    expect([...current].map((node) => node.textContent?.trim().split(' ')[0])).toEqual(['G', 'G'])
    expect(document.querySelector('[aria-label="Root"] .tile.suggest')).toBeNull()
  })
})

describe('Inspector as the phone sheet', () => {
  it('shows nudges, typing and in-key chords, and keeps the builder behind Advanced', () => {
    const onNudge = vi.fn()
    renderInspector({ phone: true, onNudge })
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    expect(onNudge).toHaveBeenCalledWith('word-right')
    expect(screen.getByRole('textbox', { name: 'Chord name' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Em vi$/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^G\/B/ })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Root' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByRole('group', { name: 'Root' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^G\/B/ })).toBeTruthy()
  })

  it('starts collapsed again for the next chord', () => {
    const view = renderInspector({ phone: true })
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    view.rerender(
      <Inspector song={song()} shapeKey={parseKey('G')} selectedId="c2" concertLabel={null} focusSignal={0}
        phone onText={() => {}} onReplace={() => {}} onDelete={() => {}} onClose={() => {}} />,
    )
    expect(screen.queryByRole('group', { name: 'Root' })).toBeNull()
  })

  it('shows everything at once on laptop', () => {
    renderInspector()
    expect(screen.getByRole('group', { name: 'Root' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Advanced' })).toBeNull()
  })
})

describe('Inspector preview toggle', () => {
  it('offers Show PDF preview on laptop and reports the toggle', () => {
    const onTogglePreview = vi.fn()
    const value = song()
    render(<Inspector song={value} shapeKey={parseKey('G')} selectedId="c1" concertLabel={null} focusSignal={0}
      previewShown={false} onTogglePreview={onTogglePreview} onText={() => {}} onReplace={() => {}} onDelete={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show PDF preview' }))
    expect(onTogglePreview).toHaveBeenCalled()
  })

  it('says Hide PDF preview while it is showing, and has no toggle on phone', () => {
    const value = song()
    const view = render(<Inspector song={value} shapeKey={parseKey('G')} selectedId="c1" concertLabel={null} focusSignal={0}
      previewShown onTogglePreview={() => {}} onText={() => {}} onReplace={() => {}} onDelete={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Hide PDF preview' })).toBeTruthy()
    view.unmount()
    renderInspector({ phone: true })
    expect(screen.queryByRole('button', { name: /PDF preview/ })).toBeNull()
  })
})
