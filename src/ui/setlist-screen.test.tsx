import { cleanup, render, screen } from '@testing-library/react'
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
  it('asks for confirmation before deleting a setlist', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onDelete } = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Setlist actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Delete setlist “Sunday”/))
    expect(onDelete).toHaveBeenCalledWith('set-1')
  })

  it('keeps the setlist when confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { onDelete } = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Setlist actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(onDelete).not.toHaveBeenCalled()
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
