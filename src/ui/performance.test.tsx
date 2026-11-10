import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { parseChord, parseKey } from '../domain/chord'
import { emptySong, idSequence } from '../domain/song'
import { StageView } from './performance'

afterEach(() => cleanup())

function songWithChords() {
  const ids = idSequence('stage')
  const song = emptySong(
    {
      title: 'Keep Smiling',
      artist: 'Dear John',
      originalKey: parseKey('D'),
      tempo: 76,
      timeSignature: '4/4',
    },
    ids,
  )
  song.sections = [
    {
      id: ids(),
      kind: 'verse',
      label: 'Verse',
      lines: [
        {
          id: ids(),
          type: 'lyric',
          text: 'Sometimes you are no longer together',
          chords: [
            { id: ids(), index: 4, symbol: parseChord('D') },
            { id: ids(), index: 22, symbol: parseChord('G') },
          ],
          needsCheck: false,
        },
      ],
    },
  ]
  song.arrangement = song.sections.map((section) => ({ sectionId: section.id }))
  return song
}

describe('StageView quiet chart', () => {
  it('shows chords over lyrics without edit or tempo chrome', () => {
    render(<StageView songs={[songWithChords()]} onExit={() => {}} />)

    expect(screen.getByText('Keep Smiling')).toBeTruthy()
    expect(screen.getByText('Dear John')).toBeTruthy()
    expect(screen.getByText('Sometimes you are no longer together')).toBeTruthy()
    expect(screen.getAllByText('D').length).toBeGreaterThan(0)
    expect(screen.getAllByText('G').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next section' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Autoscroll' })).toBeNull()
    expect(screen.queryByText(/Speed/)).toBeNull()
    expect(screen.queryByText(/76/)).toBeNull()
    expect(screen.queryByText(/4\/4/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })
})
