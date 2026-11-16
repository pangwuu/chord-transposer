import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHORTCUTS } from './shortcuts'
import { ShortcutsDialog } from './shortcuts-dialog'

afterEach(() => cleanup())

describe('the keyboard shortcuts sheet', () => {
  it('is a titled dialog that lists every shortcut the app handles', () => {
    render(<ShortcutsDialog onClose={() => {}} apple={false} />)
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    const listed = [...dialog.querySelectorAll('dt')].map((node) => node.textContent)
    expect(listed).toHaveLength(SHORTCUTS.length)
    for (const shortcut of SHORTCUTS) expect(within(screen.getByRole('region', { name: shortcut.group })).getAllByText(shortcut.does).length).toBeGreaterThan(0)
  })

  it('shows ⌘ on Apple devices and Ctrl elsewhere', () => {
    const view = render(<ShortcutsDialog onClose={() => {}} apple />)
    const search = () => screen.getByText('Search songs').closest('.shortcut-row')?.querySelector('dd')?.textContent
    expect(search()).toBe('⌘K')
    view.rerender(<ShortcutsDialog onClose={() => {}} apple={false} />)
    expect(search()).toBe('CtrlK')
  })

  it('closes with Escape and gives focus back to where it was', async () => {
    const user = userEvent.setup()
    function Host() {
      return <button type="button">Menu</button>
    }
    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Menu' })
    opener.focus()
    const onClose = vi.fn()
    const sheet = render(<ShortcutsDialog onClose={onClose} apple={false} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    sheet.unmount()
    expect(document.activeElement).toBe(opener)
  })

  it('keeps focus inside while it is open', async () => {
    const user = userEvent.setup()
    render(<><button type="button">Outside</button><ShortcutsDialog onClose={() => {}} apple={false} /></>)
    const close = screen.getByRole('button', { name: 'Close' })
    await user.tab()
    expect(document.activeElement).toBe(close)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(close)
  })
})
