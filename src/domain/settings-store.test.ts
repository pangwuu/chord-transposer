import { describe, expect, it } from 'vitest'
import { defaultSettings, type Settings } from './library-types'
import { localSettings, memorySettings, SETTINGS_KEY } from './settings-store'

function fakeStorage(start: Record<string, string> = {}): Storage {
  const held = new Map(Object.entries(start))
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
    removeItem: (key) => void held.delete(key),
    clear: () => held.clear(),
    key: () => null,
    get length() {
      return held.size
    },
  }
}

const dark: Settings = { ...defaultSettings(), theme: 'dark', accent: 'teal', prefs: { gb: true, csharp: false }, lyricSize: 14 }

describe('settings on this device', () => {
  it('reads the defaults when nothing is stored', () => {
    expect(localSettings(() => fakeStorage()).read()).toEqual(defaultSettings())
  })

  it('reads back what was written, from a fresh store on the same storage', () => {
    const storage = fakeStorage()
    localSettings(() => storage).write(dark)
    expect(localSettings(() => storage).read()).toEqual(dark)
  })

  it('reads the defaults when the stored text is not JSON', () => {
    expect(localSettings(() => fakeStorage({ [SETTINGS_KEY]: '{not json' })).read()).toEqual(defaultSettings())
  })

  it('fills in defaults for settings that are missing or of the wrong kind', () => {
    const stored = JSON.stringify({ theme: 'dark', accent: 'neon', textSize: 7, prefs: { gb: true }, lyricSize: '12' })
    expect(localSettings(() => fakeStorage({ [SETTINGS_KEY]: stored })).read()).toEqual({
      ...defaultSettings(),
      theme: 'dark',
      prefs: { gb: true, csharp: false },
    })
  })

  it('reads the defaults and drops writes when storage is blocked', () => {
    const blocked = localSettings(() => {
      throw new Error('SecurityError')
    })
    expect(blocked.read()).toEqual(defaultSettings())
    expect(() => blocked.write(dark)).not.toThrow()
  })

  it('reads the defaults when a read or write throws', () => {
    const full: Storage = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error('nope')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const store = localSettings(() => full)
    expect(store.read()).toEqual(defaultSettings())
    expect(() => store.write(dark)).not.toThrow()
  })
})

describe('settings in memory', () => {
  it('starts on the defaults and round-trips a write', () => {
    const store = memorySettings()
    expect(store.read()).toEqual(defaultSettings())
    store.write(dark)
    expect(store.read()).toEqual(dark)
  })
})
