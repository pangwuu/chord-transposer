import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, parseChord, parseKey } from '../domain/chord'
import { emptySong, idSequence } from '../domain/song'
import { ProjectorView, StageView } from './performance'

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

function renderSetlistStage() {
  const first = songWithChords()
  const second = { ...songWithChords(), id: 'second', title: 'Second Song' }
  return render(
    <StageView
      entries={[
        { song: first, concert: first.originalKey, capo: 0 },
        { song: second, concert: second.originalKey, capo: 0 },
      ]}
      nashville={false}
      prefs={DEFAULT_PREFS}
      onExit={() => {}}
    />,
  )
}

function swipe(dx: number, dy = 0) {
  const body = document.querySelector('.stage-body') as HTMLElement
  fireEvent.touchStart(body, { touches: [{ clientX: 200, clientY: 300 }] })
  fireEvent.touchEnd(body, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] })
}

const stageTitle = () => document.querySelector('.stage-title')?.textContent

describe('StageView header', () => {
  it('has no key badge beside Exit', () => {
    renderStage()
    expect(document.querySelector('.stage-key')).toBeNull()
    expect(screen.queryByText(/Original/)).toBeNull()
  })

  it('shows the song order under the artist and no Numbers label', () => {
    renderStage()
    expect(screen.getByText('Order: Verse 1 · Verse 2 · Verse 3')).toBeTruthy()
    expect(screen.queryByText('Numbers')).toBeNull()
  })

  it('goes to the section after the one scrolled to, not after the last one clicked', () => {
    renderStage()
    const body = document.querySelector('.stage-body') as HTMLElement
    const sections = [...document.querySelectorAll<HTMLElement>('[data-stage-section-index]')]
    const tops = [-400, 0, 300]
    body.getBoundingClientRect = () => ({ top: 0, bottom: 600, height: 600 }) as DOMRect
    const scrolled: number[] = []
    sections.forEach((node, index) => {
      node.getBoundingClientRect = () => ({ top: tops[index], bottom: tops[index] + 200, height: 200 }) as DOMRect
      node.scrollIntoView = () => scrolled.push(index)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next section' }))
    expect(scrolled).toEqual([2])
    const current = document.querySelector('.stage-section.is-current') as HTMLElement
    expect(current.dataset.stageSection).toBe('Verse 3')
  })
})

describe('StageView setlist songs', () => {
  it('steps back to the previous song', () => {
    renderSetlistStage()
    const previous = screen.getByRole('button', { name: 'Previous song' }) as HTMLButtonElement
    expect(previous.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }))
    expect(stageTitle()).toBe('Second Song')
    expect((screen.getByRole('button', { name: 'Next song' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Previous song' }))
    expect(stageTitle()).toBe('Keep Smiling')
  })

  it('swipes left for the next song and right for the previous one', () => {
    renderSetlistStage()
    swipe(-120)
    expect(stageTitle()).toBe('Second Song')
    swipe(120)
    expect(stageTitle()).toBe('Keep Smiling')
  })

  it('ignores a mostly vertical drag so scrolling never changes song', () => {
    renderSetlistStage()
    swipe(-90, 200)
    expect(stageTitle()).toBe('Keep Smiling')
  })

  it('has no song buttons for a single song', () => {
    renderStage()
    expect(screen.queryByRole('button', { name: 'Previous song' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Next song' })).toBeNull()
  })
})

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
    expect(screen.getByText('Speed 0.8')).toBeTruthy()
  })

  it('keeps section headings in flow after Next section (not sticky)', () => {
    renderStage()
    fireEvent.click(screen.getByRole('button', { name: 'Next section' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next section' }))

    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.map((node) => node.textContent)).toEqual(['Verse 1', 'Verse 2', 'Verse 3'])
    expect(document.querySelectorAll('.stage-sticky')).toHaveLength(0)
    for (const heading of headings) {
      expect(getComputedStyle(heading).position).not.toBe('sticky')
    }
    const current = document.querySelector('.stage-section.is-current')
    expect(current).toBeTruthy()
    expect(within(current as HTMLElement).getByRole('heading', { level: 2 }).textContent).toBe('Verse 3')
  })

  it('opens with a solid header above the title and an eye that hides it', () => {
    renderStage()

    const header = document.querySelector('.stage-chrome') as HTMLElement
    const title = screen.getByText('Keep Smiling')
    expect(header.contains(title)).toBe(false)
    expect(header.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide header' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pin' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Unpin' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Hide header' }))
    expect(screen.queryByRole('button', { name: 'Exit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Autoscroll' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Show header' })).toBeTruthy()
    expect(screen.getByText('Keep Smiling')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show header' }))
    expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide header' })).toBeTruthy()
  })

  it('nudges autoscroll speed in 0.1 steps', () => {
    renderStage()
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }))
    expect(screen.getByText('Speed 0.9')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Slower' }))
    fireEvent.click(screen.getByRole('button', { name: 'Slower' }))
    expect(screen.getByText('Speed 0.7')).toBeTruthy()
  })

  it('toggles Nashville numbers on stage without leaving the view', () => {
    renderStage()
    fireEvent.click(screen.getByRole('button', { name: '1-4-5' }))
    expect(screen.getByRole('button', { name: '1-4-5' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('rewrites transposed accidentals when preferring flats or sharps', () => {
    const ids = idSequence('bias')
    const song = emptySong({ title: 'Bias Demo', originalKey: parseKey('F') }, ids)
    song.sections = [
      {
        id: ids(),
        kind: 'verse',
        label: 'Verse',
        lines: [
          {
            id: ids(),
            type: 'lyric',
            text: 'Hello world',
            chords: [
              { id: ids(), index: 0, symbol: parseChord('F') },
              { id: ids(), index: 6, symbol: parseChord('Dm') },
            ],
            needsCheck: false,
          },
        ],
      },
    ]
    song.arrangement = song.sections.map((section) => ({ sectionId: section.id }))

    render(
      <StageView
        entries={[{ song, concert: parseKey('E'), capo: 0 }]}
        nashville={false}
        prefs={DEFAULT_PREFS}
        onExit={() => {}}
      />,
    )

    expect(screen.getAllByText('C#m').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Prefer flats' }))
    expect(screen.getByRole('button', { name: 'Prefer flats' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Prefer sharps' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getAllByText('Dbm').length).toBeGreaterThan(0)
    expect(screen.queryByText('C#m')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Prefer sharps' }))
    expect(screen.getByRole('button', { name: 'Prefer sharps' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Prefer flats' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getAllByText('C#m').length).toBeGreaterThan(0)
  })
})

describe('playing the arrangement', () => {
  function repeatedSong() {
    const song = songWithChords()
    const [first, second] = song.sections
    song.arrangement = [{ sectionId: first.id }, { sectionId: second.id }, { sectionId: first.id, repeat: 2 }]
    return song
  }

  it('shows every section the arrangement plays on stage', () => {
    const song = repeatedSong()
    const { container } = render(<StageView entries={[{ song, concert: song.originalKey, capo: 0 }]} nashville={false} prefs={DEFAULT_PREFS} onExit={() => {}} />)
    expect([...container.querySelectorAll('.stage-section-label')].map((node) => node.textContent)).toEqual(['Verse 1', 'Verse 2', 'Verse 1', 'Verse 1'])
  })

  it('gives every played section a projector slide', () => {
    render(<ProjectorView song={repeatedSong()} onExit={() => {}} />)
    expect(screen.getByText(/1\/4/)).toBeTruthy()
  })
})
