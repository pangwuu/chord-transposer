import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseKey } from '../domain/chord'
import type { Setlist } from '../domain/library-types'
import { emptySong } from '../domain/song'
import { SetlistScreen } from './setlist-screen'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function stubLayoutApis() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
}

function sunday(): Setlist {
  return { id: 'set-1', name: 'Sunday', date: '2026-03-01', entries: [] }
}

function renderScreen(onDelete = vi.fn(), onProject = vi.fn()) {
  stubLayoutApis()
  const song = emptySong({ id: 'song-1', title: 'Amazing Grace', originalKey: parseKey('G') })
  return {
    onDelete,
    onProject,
    ...render(
      <SetlistScreen
        songs={[song]}
        setlists={[sunday()]}
        onCreate={() => {}}
        onChange={() => {}}
        onDelete={onDelete}
        onExport={() => {}}
        onShare={() => {}}
        onDownload={() => {}}
        onImport={() => {}}
        onStage={() => {}}
        onProject={onProject}
      />,
    ),
  }
}

describe('SetlistScreen delete', () => {
  it('deletes straight away, with no "Are you sure?" box', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    const { onDelete } = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Setlist actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(confirm).not.toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledWith('set-1')
  })
})

describe('SetlistScreen projector', () => {
  it('opens the whole setlist in the projector view', async () => {
    const user = userEvent.setup()
    stubLayoutApis()
    const song = emptySong({ id: 'song-1', title: 'Amazing Grace', originalKey: parseKey('G') })
    const onProject = vi.fn()
    const setlist: Setlist = { ...sunday(), entries: [{ songId: song.id }] }
    render(
      <SetlistScreen songs={[song]} setlists={[setlist]} openedId="set-1" onOpen={() => {}} onCreate={() => {}} onChange={() => {}} onDelete={() => {}} onExport={() => {}} onShare={() => {}} onDownload={() => {}} onImport={() => {}} onStage={() => {}} onProject={onProject} />,
    )
    await user.click(screen.getByRole('button', { name: 'Setlist actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Projector view' }))
    expect(onProject).toHaveBeenCalledWith(setlist)
  })
})

describe('SetlistScreen adding songs', () => {
  function renderWithLibrary() {
    stubLayoutApis()
    const grace = emptySong({ id: 'grace', title: 'Amazing Grace', artist: 'John Newton', originalKey: parseKey('G') })
    const light = emptySong({ id: 'light', title: 'First Light', artist: 'Dear John', originalKey: parseKey('D') })
    const abide = emptySong({ id: 'abide', title: 'Abide With Me', artist: 'Henry Lyte', originalKey: parseKey('Eb') })
    const onChange = vi.fn()
    render(
      <SetlistScreen songs={[light, grace, abide]} setlists={[sunday()]} openedId="set-1" onOpen={() => {}} onCreate={() => {}} onChange={onChange} onDelete={() => {}} onExport={() => {}} onShare={() => {}} onDownload={() => {}} onImport={() => {}} onStage={() => {}} onProject={() => {}} />,
    )
    return { onChange }
  }

  it('finds a song by typing part of its title or artist and adds the one picked', async () => {
    const user = userEvent.setup()
    const { onChange } = renderWithLibrary()
    await user.type(screen.getByRole('combobox', { name: 'Add a song' }), 'newton')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([expect.stringContaining('Amazing Grace')])
    await user.click(screen.getByRole('option', { name: /Amazing Grace/ }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ entries: [{ songId: 'grace' }] }))
  })

  it('adds the highlighted match with Enter and clears the box for the next song', async () => {
    const user = userEvent.setup()
    const { onChange } = renderWithLibrary()
    const box = screen.getByRole('combobox', { name: 'Add a song' })
    await user.type(box, 'a')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      expect.stringContaining('Abide With Me'),
      expect.stringContaining('Amazing Grace'),
      expect.stringContaining('First Light'),
    ])
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ entries: [{ songId: 'grace' }] }))
    expect((box as HTMLInputElement).value).toBe('')
    expect(document.activeElement).toBe(box)
  })
})

describe('SetlistScreen Add song box', () => {
  const grace = emptySong({ id: 'grace', title: 'Amazing Grace', artist: 'John Newton', originalKey: parseKey('G') })
  const light = emptySong({ id: 'light', title: 'First Light', artist: 'Dear John', originalKey: parseKey('D') })
  const abide = emptySong({ id: 'abide', title: 'Abide With Me', artist: 'Henry Lyte', originalKey: parseKey('Eb') })

  function renderBox(props: Partial<Parameters<typeof SetlistScreen>[0]> = {}) {
    stubLayoutApis()
    const onChange = vi.fn()
    const view = render(
      <SetlistScreen songs={[light, grace, abide]} setlists={[sunday()]} openedId="set-1" onOpen={() => {}} onCreate={() => {}} onChange={onChange} onDelete={() => {}} onExport={() => {}} onShare={() => {}} onDownload={() => {}} onImport={() => {}} onStage={() => {}} onProject={() => {}} today="2026-03-10" {...props} />,
    )
    return { onChange, ...view }
  }
  const titles = () => screen.getAllByRole('option').map((option) => option.querySelector('strong')?.textContent)

  it('lists the whole library on focus, in the order chosen for the song list', async () => {
    const user = userEvent.setup()
    renderBox({ sort: { by: 'key', reverse: false } })
    await user.click(screen.getByRole('combobox', { name: 'Add a song' }))
    expect(titles()).toEqual(['First Light', 'Abide With Me', 'Amazing Grace'])
  })

  it('follows the reverse of that order too', async () => {
    const user = userEvent.setup()
    renderBox({ sort: { by: 'title', reverse: true } })
    await user.click(screen.getByRole('combobox', { name: 'Add a song' }))
    expect(titles()).toEqual(['First Light', 'Amazing Grace', 'Abide With Me'])
  })

  it('marks songs already in the setlist and still lets them be added again', async () => {
    const user = userEvent.setup()
    const setlist: Setlist = { ...sunday(), entries: [{ songId: 'grace' }] }
    const { onChange } = renderBox({ setlists: [setlist] })
    await user.click(screen.getByRole('combobox', { name: 'Add a song' }))
    expect(screen.getByRole('option', { name: /Amazing Grace/ }).textContent).toContain('In set')
    expect(screen.getByRole('option', { name: /First Light/ }).textContent).not.toContain('In set')
    await user.click(screen.getByRole('option', { name: /Amazing Grace/ }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ entries: [{ songId: 'grace' }, { songId: 'grace' }] }))
  })

  it('says when and in which key each song was last played', async () => {
    const user = userEvent.setup()
    const past: Setlist = { id: 'past', name: 'Last week', date: '2026-03-03', entries: [{ songId: 'grace', key: parseKey('A'), capo: 2 }] }
    const tonight: Setlist = { id: 'tonight', name: 'Tonight', date: '2026-03-10', entries: [{ songId: 'light' }] }
    renderBox({ setlists: [sunday(), past, tonight] })
    await user.click(screen.getByRole('combobox', { name: 'Add a song' }))
    expect(screen.getByRole('option', { name: /Amazing Grace/ }).textContent).toMatch(/Last played .*3.* · A · Capo 2/)
    expect(screen.getByRole('option', { name: /First Light/ }).textContent).toContain('Not played yet')
  })

  it('adds a tapped song when iOS still sends mousedown after a cancelled pointerdown', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBox()
    const box = screen.getByRole('combobox', { name: 'Add a song' })
    await user.click(box)
    const option = screen.getByRole('option', { name: /Amazing Grace/ })
    fireEvent.pointerDown(option, { pointerType: 'touch' })
    const focusMoves = fireEvent.mouseDown(option)
    if (focusMoves) act(() => box.blur())
    fireEvent.click(option)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ entries: [{ songId: 'grace' }] }))
    expect(document.activeElement).toBe(box)
  })

  it('works from the keyboard alone: Tab in, type, arrows, Enter, and Escape closes', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBox()
    const box = screen.getByRole('combobox', { name: 'Add a song' })
    while (document.activeElement !== box) await user.tab()
    expect(titles()).toEqual(['Abide With Me', 'Amazing Grace', 'First Light'])
    await user.keyboard('i')
    expect(titles()).toEqual(['Abide With Me', 'Amazing Grace', 'First Light'])
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}')
    expect(screen.getByRole('option', { name: /Amazing Grace/ }).getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ entries: [{ songId: 'grace' }] }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('option')).toBeNull()
    expect(box.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('SetlistScreen running order', () => {
  it('offers Copy running order, disabled while the setlist is empty', async () => {
    const user = userEvent.setup()
    stubLayoutApis()
    const song = emptySong({ id: 'song-1', title: 'Amazing Grace', originalKey: parseKey('G') })
    const onCopyOrder = vi.fn()
    const filled: Setlist = { ...sunday(), entries: [{ songId: song.id }] }
    const props = { songs: [song], openedId: 'set-1', onOpen: () => {}, onCreate: () => {}, onChange: () => {}, onDelete: () => {}, onExport: () => {}, onShare: () => {}, onDownload: () => {}, onImport: () => {}, onStage: () => {}, onProject: () => {}, onCopyOrder }
    const view = render(<SetlistScreen {...props} setlists={[sunday()]} />)
    await user.click(screen.getByRole('button', { name: 'Setlist actions' }))
    expect((screen.getByRole('menuitem', { name: 'Copy running order' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('menuitem', { name: 'Share running order' })).toBeNull()
    view.rerender(<SetlistScreen {...props} setlists={[filled]} onShareOrder={() => {}} />)
    await user.click(screen.getByRole('menuitem', { name: 'Copy running order' }))
    expect(onCopyOrder).toHaveBeenCalledWith(filled)
    await user.click(screen.getByRole('button', { name: 'Setlist actions' }))
    expect(screen.getByRole('menuitem', { name: 'Share running order' })).toBeTruthy()
  })
})
