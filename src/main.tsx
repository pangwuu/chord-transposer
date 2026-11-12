import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { idbLibrary } from './domain/idb-library'
import { localSettings } from './domain/settings-store'
import { App } from './ui/App'
import './styles.css'

/** Test mode is a Vite mode, fixed when the bundle is built: a production build has no way into it. */
async function stores() {
  if (import.meta.env.MODE === 'e2e') return (await import('./test-mode')).testStores()
  return { library: idbLibrary(), settingsStore: localSettings() }
}

void stores().then(({ library, settingsStore }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App library={library} settingsStore={settingsStore} />
    </StrictMode>,
  )
})
