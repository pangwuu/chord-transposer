import type { LibraryRepository, LibrarySnapshot } from './domain/library-types'
import { memoryLibrary } from './domain/memory-library'
import { localSettings, type SettingsStore } from './domain/settings-store'

const LIBRARY_KEY = 'csm-test-library'

/**
 * What the app runs on in test mode (`vite --mode e2e`): no backend and nothing left on the machine.
 * The library and settings are held in the tab's sessionStorage, so they last through a reload and end with the tab.
 */
export function testStores(): { library: LibraryRepository; settingsStore: SettingsStore } {
  const held = sessionStorage.getItem(LIBRARY_KEY)
  const library = memoryLibrary(held ? (JSON.parse(held) as LibrarySnapshot) : undefined)
  library.subscribe((snapshot) => sessionStorage.setItem(LIBRARY_KEY, JSON.stringify(snapshot)))
  document.documentElement.dataset.library = 'test'
  return { library, settingsStore: localSettings(() => sessionStorage) }
}
