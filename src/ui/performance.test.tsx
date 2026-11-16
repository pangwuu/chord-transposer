import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    expect(screen.getByRole('button', { name: 'Exit' }).textContent).toBe('')
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
    render(<ProjectorView songs={[repeatedSong()]} onExit={() => {}} />)
    expect(screen.getByText(/1\/4/)).toBeTruthy()
  })
})

describe('StageView text size', () => {
  const bodySize = () => (document.querySelector('.stage-body') as HTMLElement).style.fontSize

  it('starts at 24px and steps up and down from the header', () => {
    renderStage()
    expect(bodySize()).toBe('24px')
    fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
    expect(bodySize()).toBe('28px')
    fireEvent.click(screen.getByRole('button', { name: 'Smaller text' }))
    fireEvent.click(screen.getByRole('button', { name: 'Smaller text' }))
    expect(bodySize()).toBe('22px')
  })

  it('stops at the smallest and largest sizes', () => {
    renderStage()
    const smaller = screen.getByRole('button', { name: 'Smaller text' })
    for (let i = 0; i < 10; i += 1) fireEvent.click(smaller)
    expect(bodySize()).toBe('18px')
    expect((smaller as HTMLButtonElement).disabled).toBe(true)
    const larger = screen.getByRole('button', { name: 'Larger text' })
    for (let i = 0; i < 20; i += 1) fireEvent.click(larger)
    expect(bodySize()).toBe('40px')
    expect((larger as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('StageView remembers text size', () => {
  afterEach(() => localStorage.clear())

  it('opens at the last size used on this device', () => {
    localStorage.setItem('csm-stage-size', '32')
    renderStage()
    expect((document.querySelector('.stage-body') as HTMLElement).style.fontSize).toBe('32px')
    fireEvent.click(screen.getByRole('button', { name: 'Smaller text' }))
    expect(localStorage.getItem('csm-stage-size')).toBe('28')
  })
})

describe('StageView page-turner pedal', () => {
  const currentSection = () => (document.querySelector('.stage-section.is-current') as HTMLElement | null)?.dataset.stageSection
  const press = (key: string) => fireEvent.keyDown(window, { key })

  it('turns to the next and previous section with Page Down and Page Up', () => {
    renderStage()
    press('PageDown')
    press('PageDown')
    expect(currentSection()).toBe('Verse 3')
    press('PageUp')
    expect(currentSection()).toBe('Verse 2')
  })

  it('turns sections with the up and down arrows too', () => {
    renderStage()
    press('ArrowDown')
    expect(currentSection()).toBe('Verse 2')
    press('ArrowUp')
    expect(currentSection()).toBe('Verse 1')
  })

  it('goes on to the next song after the last section, so one pedal steps through the set', () => {
    renderSetlistStage()
    press('PageDown')
    press('PageDown')
    expect(stageTitle()).toBe('Keep Smiling')
    press('PageDown')
    expect(stageTitle()).toBe('Second Song')
    expect(currentSection()).toBe('Verse 1')
  })

  it('changes song with the left and right arrows', () => {
    renderSetlistStage()
    press('ArrowRight')
    expect(stageTitle()).toBe('Second Song')
    press('ArrowLeft')
    expect(stageTitle()).toBe('Keep Smiling')
  })

  it('leaves the arrows to the key picker while it has focus', () => {
    renderSetlistStage()
    fireEvent.keyDown(screen.getByLabelText('Key'), { key: 'ArrowRight' })
    expect(stageTitle()).toBe('Keep Smiling')
  })
})

describe('ProjectorView for a setlist', () => {
  it('runs every song in order, one slide per section, and names the song on screen', () => {
    const first = songWithChords()
    const second = { ...songWithChords(), id: 'second', title: 'Second Song' }
    render(<ProjectorView songs={[first, second]} onExit={() => {}} />)
    expect(screen.getByText('Keep Smiling · Verse 1 · 1/6')).toBeTruthy()
    for (let i = 0; i < 3; i += 1) fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Second Song · Verse 1 · 4/6')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Keep Smiling · Verse 3 · 3/6')).toBeTruthy()
  })
})

describe('StageView notes', () => {
  function renderNotes(songNotes: string | undefined, entryNotes: string | undefined) {
    const song = { ...songWithChords(), notes: songNotes }
    return render(<StageView entries={[{ song, concert: song.originalKey, capo: 0, notes: entryNotes }]} nashville={false} prefs={DEFAULT_PREFS} onExit={() => {}} />)
  }
  const notes = () => [...document.querySelectorAll('.stage-notes')].map((node) => node.textContent)

  it('shows the song notes under the title', () => {
    renderNotes('Start soft, build on chorus 2', undefined)
    expect(notes()).toEqual(['Start soft, build on chorus 2'])
    expect(document.querySelector('.stage-head')?.contains(document.querySelector('.stage-notes'))).toBe(true)
  })

  it('shows the setlist entry notes', () => {
    renderNotes(undefined, 'Capo 4 for acoustic')
    expect(notes()).toEqual(['Capo 4 for acoustic'])
  })

  it('shows the setlist entry notes first when there are both', () => {
    renderNotes('Start soft', 'Capo 4 for acoustic')
    expect(notes()).toEqual(['Capo 4 for acoustic', 'Start soft'])
  })

  it('adds nothing when there are no notes', () => {
    renderNotes(undefined, undefined)
    expect(document.querySelector('.stage-notes')).toBeNull()
    cleanup()
    renderNotes('   ', '')
    expect(document.querySelector('.stage-notes')).toBeNull()
  })

  it('keeps the lines of notes written on several lines', () => {
    renderNotes('Start soft\nBuild on chorus 2', undefined)
    expect(document.querySelector('.stage-notes')?.textContent).toBe('Start soft\nBuild on chorus 2')
  })

  it('keeps the notes when the header controls are hidden', () => {
    renderNotes('Start soft', undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Hide header' }))
    expect(notes()).toEqual(['Start soft'])
  })

  it('shows the next song\'s notes after moving on', () => {
    const first = { ...songWithChords(), notes: 'First notes' }
    const second = { ...songWithChords(), id: 'second', title: 'Second Song', notes: undefined }
    render(<StageView entries={[{ song: first, concert: first.originalKey, capo: 0 }, { song: second, concert: second.originalKey, capo: 0, notes: 'Second entry notes' }]} nashville={false} prefs={DEFAULT_PREFS} onExit={() => {}} />)
    expect(notes()).toEqual(['First notes'])
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }))
    expect(notes()).toEqual(['Second entry notes'])
  })
})

describe('StageView chords used and easy chords', () => {
  const strip = () => [...(screen.getByLabelText('Chords used').children)].map((node) => node.textContent)

  it('lists the song\'s chords once each under the title', () => {
    renderStage()
    expect(strip()).toEqual(['D', 'G', 'A'])
    expect(document.querySelector('.stage-head')?.contains(screen.getByLabelText('Chords used'))).toBe(true)
  })

  it('follows the key, the capo and Nashville numbers', () => {
    renderStage({ nashville: true })
    expect(strip()).toEqual(['1', '4', '5'])
    fireEvent.click(screen.getByRole('button', { name: '1-4-5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Key up a semitone' }))
    expect(strip()).toEqual(['Eb', 'Ab', 'Bb'])
  })

  it('shows plain chords when Easy is on, and the written ones again when off', () => {
    const song = songWithChords()
    const line = song.sections[0].lines[0]
    if (line.type === 'lyric') line.chords[0].symbol = parseChord('Dmaj7/F#')
    const before = structuredClone(song)
    render(<StageView entries={[{ song, concert: song.originalKey, capo: 0 }]} nashville={false} prefs={DEFAULT_PREFS} onExit={() => {}} />)
    expect(strip()).toEqual(['Dmaj7/F#', 'G', 'A'])
    const easy = screen.getByRole('button', { name: 'Easy' })
    expect(easy.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(easy)
    expect(easy.getAttribute('aria-pressed')).toBe('true')
    expect(strip()).toEqual(['D', 'G', 'A'])
    expect(document.querySelector('.stage-chord')?.textContent).toBe('D')
    fireEvent.click(easy)
    expect(document.querySelector('.stage-chord')?.textContent).toBe('Dmaj7/F#')
    expect(song).toEqual(before)
  })
})

describe('StageView picks up where it left off', () => {
  const KEY = 'csm-stage-position'
  afterEach(() => localStorage.clear())

  function setlistEntries() {
    const first = songWithChords()
    const second = { ...songWithChords(), id: 'second', title: 'Second Song' }
    return [{ song: first, concert: first.originalKey, capo: 0 }, { song: second, concert: second.originalKey, capo: 0 }]
  }
  const open = (id = 'sunday', entries = setlistEntries()) =>
    render(<StageView entries={entries} source={{ kind: 'setlist', id }} nashville={false} prefs={DEFAULT_PREFS} onExit={() => {}} />)
  const current = () => (document.querySelector('.stage-section.is-current') as HTMLElement | null)?.dataset.stageSection
  const keyShown = () => (screen.getByLabelText('Key') as HTMLSelectElement).value
  const capoShown = () => (screen.getByLabelText('Capo') as HTMLSelectElement).value

  function playToSecondSongVerseTwo() {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }))
    fireEvent.click(screen.getByRole('button', { name: 'Key up a semitone' }))
    fireEvent.change(screen.getByLabelText('Capo'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next section' }))
    expect(current()).toBe('Verse 2')
    cleanup()
  }

  it('reopens the same setlist at the same song and section, in the same key and capo', () => {
    playToSecondSongVerseTwo()
    open()
    expect(stageTitle()).toBe('Second Song')
    expect(current()).toBe('Verse 2')
    expect(keyShown()).toBe('Eb')
    expect(capoShown()).toBe('2')
    expect(screen.getByRole('status').textContent).toContain('Back at Verse 2')
    expect(screen.getByRole('button', { name: 'Autoscroll' })).toBeTruthy()
  })

  it('goes to song 1, section 1 on Start from the top', () => {
    playToSecondSongVerseTwo()
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Start from the top' }))
    expect(stageTitle()).toBe('Keep Smiling')
    expect(current()).toBe('Verse 1')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('starts a different setlist from the top, with no notice', () => {
    playToSecondSongVerseTwo()
    open('easter')
    expect(stageTitle()).toBe('Keep Smiling')
    expect(current()).toBe('Verse 1')
    expect(keyShown()).toBe('D')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('starts from the top once the position is more than three hours old', () => {
    playToSecondSongVerseTwo()
    const held = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    localStorage.setItem(KEY, JSON.stringify({ ...held, at: Date.now() - 3 * 60 * 60 * 1000 - 1000 }))
    open()
    expect(stageTitle()).toBe('Keep Smiling')
    expect(current()).toBe('Verse 1')
  })

  it('finds the song by itself when the setlist was reordered, and starts from the top when it was removed', () => {
    playToSecondSongVerseTwo()
    const [first, second] = setlistEntries()
    const extra = { ...first, song: { ...first.song, id: 'third', title: 'Third Song' } }
    open('sunday', [extra, first, second])
    expect(stageTitle()).toBe('Second Song')
    expect(current()).toBe('Verse 2')
    cleanup()
    localStorage.clear()
    playToSecondSongVerseTwo()
    open('sunday', [first, extra])
    expect(stageTitle()).toBe('Keep Smiling')
    expect(current()).toBe('Verse 1')
  })

  it('opens normally when storage is blocked or holds something else', () => {
    localStorage.setItem(KEY, '{not json')
    open()
    expect(stageTitle()).toBe('Keep Smiling')
    cleanup()
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    const full = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    open()
    expect(stageTitle()).toBe('Keep Smiling')
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }))
    expect(stageTitle()).toBe('Second Song')
    blocked.mockRestore()
    full.mockRestore()
  })

  it('remembers nothing when it was not told what was opened', () => {
    renderSetlistStage()
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }))
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
