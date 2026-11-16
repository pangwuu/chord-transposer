export type ShortcutGroup = 'Anywhere' | 'Song' | 'Section' | 'Selected chord' | 'Stage' | 'Projector'

export type Shortcut = {
  id: string
  group: ShortcutGroup
  /** Keys joined with `+`. `Mod` is ⌘ on Apple devices and Ctrl elsewhere. */
  combos: string[]
  does: string
}

/**
 * Every keyboard shortcut in the app. The key handlers look keys up here and the shortcuts sheet
 * prints it, so the sheet cannot drift from what the keys do.
 */
export const SHORTCUTS: Shortcut[] = [
  { id: 'help', group: 'Anywhere', combos: ['?'], does: 'Show keyboard shortcuts' },
  { id: 'search', group: 'Anywhere', combos: ['Mod+K'], does: 'Search songs' },
  { id: 'undo', group: 'Song', combos: ['Mod+Z'], does: 'Undo' },
  { id: 'redo', group: 'Song', combos: ['Mod+Y', 'Mod+Shift+Z'], does: 'Redo' },
  { id: 'key-up', group: 'Song', combos: ['Mod+]'], does: 'Key up a semitone' },
  { id: 'key-down', group: 'Song', combos: ['Mod+['], does: 'Key down a semitone' },
  { id: 'duplicate-section', group: 'Section', combos: ['Mod+D'], does: 'Duplicate the section' },
  { id: 'section-up', group: 'Section', combos: ['Alt+Shift+ArrowUp'], does: 'Move the section up' },
  { id: 'section-down', group: 'Section', combos: ['Alt+Shift+ArrowDown'], does: 'Move the section down' },
  { id: 'chord-left', group: 'Selected chord', combos: ['ArrowLeft'], does: 'Move a letter left' },
  { id: 'chord-right', group: 'Selected chord', combos: ['ArrowRight'], does: 'Move a letter right' },
  { id: 'chord-word-left', group: 'Selected chord', combos: ['Alt+ArrowLeft'], does: 'Move a word left' },
  { id: 'chord-word-right', group: 'Selected chord', combos: ['Alt+ArrowRight'], does: 'Move a word right' },
  { id: 'chord-start', group: 'Selected chord', combos: ['Home'], does: 'Move to the start of the line' },
  { id: 'chord-end', group: 'Selected chord', combos: ['End'], does: 'Move to the end of the line' },
  { id: 'chord-edit', group: 'Selected chord', combos: ['Enter', 'F2'], does: 'Edit the chord' },
  { id: 'chord-delete', group: 'Selected chord', combos: ['Delete', 'Backspace'], does: 'Remove the chord' },
  { id: 'chord-deselect', group: 'Selected chord', combos: ['Escape'], does: 'Deselect' },
  { id: 'stage-play', group: 'Stage', combos: ['Space'], does: 'Start or stop autoscroll' },
  { id: 'stage-next-section', group: 'Stage', combos: ['PageDown', 'ArrowDown'], does: 'Next section, then the next song' },
  { id: 'stage-previous-section', group: 'Stage', combos: ['PageUp', 'ArrowUp'], does: 'Previous section, then the previous song' },
  { id: 'stage-next-song', group: 'Stage', combos: ['ArrowRight'], does: 'Next song' },
  { id: 'stage-previous-song', group: 'Stage', combos: ['ArrowLeft'], does: 'Previous song' },
  { id: 'stage-exit', group: 'Stage', combos: ['Escape'], does: 'Exit' },
  { id: 'projector-next', group: 'Projector', combos: ['ArrowRight', 'Space', 'PageDown', 'ArrowDown'], does: 'Next slide' },
  { id: 'projector-previous', group: 'Projector', combos: ['ArrowLeft', 'PageUp', 'ArrowUp'], does: 'Previous slide' },
  { id: 'projector-exit', group: 'Projector', combos: ['Escape'], does: 'Exit' },
]

export const SHORTCUT_GROUPS: ShortcutGroup[] = ['Anywhere', 'Song', 'Section', 'Selected chord', 'Stage', 'Projector']

type Keys = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>


function pressed(event: Keys, combo: string): boolean {
  const parts = combo.split('+')
  const key = parts[parts.length - 1]
  const wants = (modifier: string) => parts.slice(0, -1).includes(modifier)
  const typed = event.key === ' ' ? 'Space' : event.key
  if (typed.toLowerCase() !== key.toLowerCase()) return false
  if (wants('Mod') !== (event.metaKey || event.ctrlKey)) return false
  if (wants('Alt') !== event.altKey) return false
  // Shift is only checked where a shortcut asks for it: `?` and `]` need it on some keyboards.
  return !wants('Shift') || event.shiftKey
}

/** The shortcut a key press means among these groups, or null. The combo naming the most keys wins, so ⌘⇧Z is redo, not undo. */
export function shortcutFor(event: Keys, groups: ShortcutGroup[]): string | null {
  let best: { id: string; size: number } | null = null
  for (const shortcut of SHORTCUTS) {
    if (!groups.includes(shortcut.group)) continue
    for (const combo of shortcut.combos) {
      const size = combo.split('+').length
      if (pressed(event, combo) && (!best || size > best.size)) best = { id: shortcut.id, size }
    }
  }
  return best?.id ?? null
}

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', PageDown: 'Page Down', PageUp: 'Page Up', Escape: 'Esc',
}

/** A combo as its key caps, such as `['⌘', 'Z']` on a Mac and `['Ctrl', 'Z']` elsewhere. */
export function comboKeys(combo: string, apple: boolean): string[] {
  return combo.split('+').map((part) => {
    if (part === 'Mod') return apple ? '⌘' : 'Ctrl'
    if (part === 'Alt') return apple ? '⌥' : 'Alt'
    if (part === 'Shift') return apple ? '⇧' : 'Shift'
    return KEY_NAMES[part] ?? part
  })
}

export function isApple(platform: string = typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform)
}

