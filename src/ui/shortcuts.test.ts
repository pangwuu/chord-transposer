import { describe, expect, it } from 'vitest'
import { comboKeys, shortcutFor, SHORTCUT_GROUPS, SHORTCUTS } from './shortcuts'
import { wantsInstallHint } from './install-hint'

const press = (key: string, modifiers: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers,
})

function eventFor(combo: string) {
  const parts = combo.split('+')
  const key = parts[parts.length - 1]
  return press(key === 'Space' ? ' ' : key, { ctrlKey: parts.includes('Mod'), altKey: parts.includes('Alt'), shiftKey: parts.includes('Shift') })
}

describe('keyboard shortcuts', () => {
  it('every listed key press is the shortcut it is listed under', () => {
    for (const shortcut of SHORTCUTS) {
      for (const combo of shortcut.combos) expect(shortcutFor(eventFor(combo), [shortcut.group]), `${shortcut.group}: ${combo}`).toBe(shortcut.id)
    }
  })

  it('has no two shortcuts on one key within a group, and every group is shown', () => {
    for (const group of SHORTCUT_GROUPS) {
      const combos = SHORTCUTS.filter((shortcut) => shortcut.group === group).flatMap((shortcut) => shortcut.combos.map((combo) => combo.toLowerCase()))
      expect(combos.length).toBeGreaterThan(0)
      expect(new Set(combos).size, group).toBe(combos.length)
    }
    expect(new Set(SHORTCUTS.map((shortcut) => shortcut.group))).toEqual(new Set(SHORTCUT_GROUPS))
  })

  it('reads ⌘ and Ctrl alike, and tells undo from redo', () => {
    expect(shortcutFor(press('z', { metaKey: true }), ['Song'])).toBe('undo')
    expect(shortcutFor(press('z', { ctrlKey: true }), ['Song'])).toBe('undo')
    expect(shortcutFor(press('Z', { metaKey: true, shiftKey: true }), ['Song'])).toBe('redo')
    expect(shortcutFor(press('y', { ctrlKey: true }), ['Song'])).toBe('redo')
    expect(shortcutFor(press('k', { metaKey: true }), ['Anywhere'])).toBe('search')
  })

  it('tells a letter move from a word move, and ignores keys that mean nothing', () => {
    expect(shortcutFor(press('ArrowLeft'), ['Selected chord'])).toBe('chord-left')
    expect(shortcutFor(press('ArrowLeft', { altKey: true }), ['Selected chord'])).toBe('chord-word-left')
    expect(shortcutFor(press('ArrowUp', { altKey: true, shiftKey: true }), ['Section'])).toBe('section-up')
    expect(shortcutFor(press('z'), ['Song'])).toBeNull()
    expect(shortcutFor(press('?', { shiftKey: true }), ['Anywhere'])).toBe('help')
    expect(shortcutFor(press('?', { shiftKey: true, metaKey: true }), ['Anywhere'])).toBeNull()
    expect(shortcutFor(press('PageDown'), ['Song', 'Section'])).toBeNull()
  })

  it('shows ⌘ on Apple devices and Ctrl elsewhere', () => {
    expect(comboKeys('Mod+Z', true)).toEqual(['⌘', 'Z'])
    expect(comboKeys('Mod+Z', false)).toEqual(['Ctrl', 'Z'])
    expect(comboKeys('Alt+Shift+ArrowUp', false)).toEqual(['Alt', 'Shift', '↑'])
    expect(comboKeys('Alt+Shift+ArrowUp', true)).toEqual(['⌥', '⇧', '↑'])
  })
})

describe('the Add to Home Screen hint', () => {
  const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  const iphoneChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1'
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

  it('shows in Safari on an iPhone that has not installed the app', () => {
    expect(wantsInstallHint({ userAgent: iphoneSafari, standalone: false, dismissed: false })).toBe(true)
  })

  it('never shows inside the installed app, or once dismissed', () => {
    expect(wantsInstallHint({ userAgent: iphoneSafari, standalone: true, dismissed: false })).toBe(false)
    expect(wantsInstallHint({ userAgent: iphoneSafari, standalone: false, dismissed: true })).toBe(false)
  })

  it('does not show where Add to Home Screen is not how the app is kept', () => {
    for (const userAgent of [iphoneChrome, android, mac]) expect(wantsInstallHint({ userAgent, standalone: false, dismissed: false })).toBe(false)
  })
})
