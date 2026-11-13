import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { BandSession } from './domain/band'
import { localSettings, type SettingsStore } from './domain/settings-store'
import { BandGate, takeLaunchInvite } from './ui/band-gate'
import './styles.css'

/** Test mode is a Vite mode, fixed when the bundle is built: a production build has no way into it. */
async function services(): Promise<{ session: BandSession; settingsStore: SettingsStore; deviceStorage: () => Storage }> {
  if (import.meta.env.MODE === 'e2e') return (await import('./test-mode')).testServices()
  const { firebaseBands } = await import('./firebase/services')
  return { session: firebaseBands(import.meta.env), settingsStore: localSettings(), deviceStorage: () => localStorage }
}

const launchInvite = takeLaunchInvite()

void services().then(({ session, settingsStore, deviceStorage }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BandGate session={session} settingsStore={settingsStore} deviceStorage={deviceStorage} launchInvite={launchInvite} />
    </StrictMode>,
  )
})
