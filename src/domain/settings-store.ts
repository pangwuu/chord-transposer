import { ACCENTS, defaultSettings, type Settings } from './library-types'

/** Per-device settings. Synchronous, so the theme is known before first render. Never shared with the band. */
export type SettingsStore = {
  read(): Settings
  write(settings: Settings): void
}

/** Also read by the inline script in `index.html`, which paints the theme before the app loads. */
export const SETTINGS_KEY = 'csm-settings'

/** Settings from anything: stored text, a backup file. Whatever is missing or of the wrong kind falls back to its default. */
export function settingsFrom(value: unknown): Settings {
  const defaults = defaultSettings()
  if (typeof value !== 'object' || value === null) return defaults
  const raw = value as Record<string, unknown>
  const prefs = (typeof raw.prefs === 'object' && raw.prefs !== null ? raw.prefs : {}) as Record<string, unknown>
  const oneOf = <T extends string>(candidate: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(candidate as T) ? (candidate as T) : fallback
  const panes = (typeof raw.panes === 'object' && raw.panes !== null ? raw.panes : {}) as Record<string, unknown>
  const width = <T,>(candidate: unknown, fallback: T) => (typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback)
  const flag = (candidate: unknown, fallback: boolean) => (typeof candidate === 'boolean' ? candidate : fallback)
  const part = (candidate: unknown) => (typeof candidate === 'object' && candidate !== null ? candidate : {}) as Record<string, unknown>
  const sort = part(raw.songSort)
  const dismissed = part(raw.dismissed)
  return {
    theme: oneOf(raw.theme, ['system', 'light', 'dark'], defaults.theme),
    accent: oneOf(raw.accent, ACCENTS, defaults.accent),
    textSize: oneOf(raw.textSize, ['s', 'm', 'l'], defaults.textSize),
    numbers: flag(raw.numbers, defaults.numbers),
    prefs: { gb: flag(prefs.gb, defaults.prefs.gb), csharp: flag(prefs.csharp, defaults.prefs.csharp) },
    normalise: flag(raw.normalise, defaults.normalise),
    paper: oneOf(raw.paper, ['a4', 'letter'], defaults.paper),
    lyricSize: typeof raw.lyricSize === 'number' && Number.isFinite(raw.lyricSize) ? raw.lyricSize : defaults.lyricSize,
    allowTwoColumns: flag(raw.allowTwoColumns, defaults.allowTwoColumns),
    panes: {
      library: width(panes.library, defaults.panes.library),
      inspector: width(panes.inspector, defaults.panes.inspector),
      preview: width(panes.preview, defaults.panes.preview),
    },
    songSort: { by: oneOf(sort.by, ['title', 'added', 'edited', 'key'], defaults.songSort.by), reverse: flag(sort.reverse, defaults.songSort.reverse) },
    flagUnusual: flag(raw.flagUnusual, defaults.flagUnusual),
    dismissed: { firstSong: flag(dismissed.firstSong, false), install: flag(dismissed.install, false) },
  }
}

/** Settings kept in browser storage. `storage` is a function because reaching for `localStorage` can itself throw. */
export function localSettings(storage: () => Storage = () => localStorage): SettingsStore {
  return {
    read() {
      try {
        return settingsFrom(JSON.parse(storage().getItem(SETTINGS_KEY) ?? 'null'))
      } catch {
        return defaultSettings()
      }
    },
    write(settings) {
      try {
        storage().setItem(SETTINGS_KEY, JSON.stringify(settings))
      } catch {
        // Storage is blocked or full: the settings last for this visit only.
      }
    },
  }
}

export function memorySettings(initial: Settings = defaultSettings()): SettingsStore {
  let held = structuredClone(initial)
  return {
    read: () => structuredClone(held),
    write(settings) {
      held = structuredClone(settings)
    },
  }
}
