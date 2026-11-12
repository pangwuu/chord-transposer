import { defineConfig, devices } from '@playwright/test'

// The real app against the Firebase emulators: `npm run test:e2e:emulator` starts them first.
// Vite mode `emulator` sets no `VITE_FIREBASE_*` vars, so the development build points at the emulators.
const baseURL = 'http://127.0.0.1:5175'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.emulator.spec.ts',
  timeout: 150_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: {
    command:
      'npx vite --mode emulator --host 127.0.0.1 --port 5175 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
})
