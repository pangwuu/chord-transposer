import type { BandSession } from './domain/band'
import { memoryBands } from './domain/memory-bands'
import { localSettings, type SettingsStore } from './domain/settings-store'

/** An e2e test that wants the recovery prompt sets this before the app loads. Every other test starts past it. */
const SHOW_RECOVERY_KEY = 'csm-test-show-recovery'

/**
 * What the app runs on in test mode (`vite --mode e2e`): no backend and nothing left on the machine.
 * The band and settings are held in the tab's sessionStorage, so they last through a reload and end with the tab.
 */
export function testServices(): { session: BandSession; settingsStore: SettingsStore; deviceStorage: () => Storage } {
  document.documentElement.dataset.library = 'test'
  if (sessionStorage.getItem(SHOW_RECOVERY_KEY) !== '1') sessionStorage.setItem('csm-recovery-prompted', '1')
  return { session: memoryBands(sessionStorage), settingsStore: localSettings(() => sessionStorage), deviceStorage: () => sessionStorage }
}
