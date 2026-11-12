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

function renderScreen(onDelete = vi.fn()) {
  stubLayoutApis()
  const song = emptySong({ id: 'song-1', title: 'Amazing Grace', originalKey: parseKey('G') })
  return {
    onDelete,
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
