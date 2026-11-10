import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, parseChord, parseKey } from '../domain/chord'
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
      label: 'Verse 1',
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
    {
      id: ids(),
      kind: 'verse',
      label: 'Verse 2',
      lines: [
        {
          id: ids(),
          type: 'lyric',
          text: 'Holding on to what we used to be',
          chords: [{ id: ids(), index: 0, symbol: parseChord('A') }],
          needsCheck: false,
        },
      ],
    },
    {
      id: ids(),
      kind: 'verse',
      label: 'Verse 3',
      lines: [
        {
          id: ids(),
          type: 'lyric',
          text: 'The Lord has promised good to me',
          chords: [{ id: ids(), index: 0, symbol: parseChord('G') }],
          needsCheck: false,
        },
      ],
    },
  ]
  song.arrangement = song.sections.map((section) => ({ sectionId: section.id }))
  return song
}

function renderStage(overrides: { nashville?: boolean } = {}) {
  const song = songWithChords()
  return render(
    <StageView
      entries={[{ song, concert: song.originalKey, capo: 0 }]}
      nashville={overrides.nashville ?? false}
      prefs={DEFAULT_PREFS}
      onExit={() => {}}
    />,
  )
}

describe('StageView quiet chart', () => {
  it('shows chords over lyrics with hideable transport, not song edit fields', () => {
    renderStage()

    expect(screen.getByText('Keep Smiling')).toBeTruthy()
    expect(screen.getByText('Dear John')).toBeTruthy()
    expect(screen.getByText('Sometimes you are no longer together')).toBeTruthy()
    expect(screen.getAllByText('D').length).toBeGreaterThan(0)
    expect(screen.getAllByText('G').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next section' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Autoscroll' })).toBeTruthy()
    expect(screen.getByLabelText('Key')).toBeTruthy()
    expect(screen.getByLabelText('Capo')).toBeTruthy()
    expect(screen.getByRole('button', { name: '1-4-5' })).toBeTruthy()
    expect(screen.queryByText(/76/)).toBeNull()
    expect(screen.queryByText(/4\/4/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(document.querySelector('.stage-sticky')).toBeNull()
  })

  it('keeps a single section heading after Next section (no sticky overlay)', () => {
    renderStage()
    fireEvent.click(screen.getByRole('button', { name: 'Next section' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next section' }))

    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.map((node) => node.textContent)).toEqual(['Verse 1', 'Verse 2', 'Verse 3'])
    expect(document.querySelectorAll('.stage-sticky')).toHaveLength(0)
    const current = document.querySelector('.stage-section.is-current')
    expect(current).toBeTruthy()
    expect(within(current as HTMLElement).getByRole('heading', { level: 2 }).textContent).toBe('Verse 3')
  })

  it('toggles Nashville numbers on stage without leaving the view', () => {
    renderStage()
    fireEvent.click(screen.getByRole('button', { name: '1-4-5' }))
    expect(screen.getByRole('button', { name: '1-4-5' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })
})
