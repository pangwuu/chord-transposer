import { defineConfig, devices } from '@playwright/test'

// The suite runs the app in test mode (Vite mode `e2e`): an in-memory library, no backend.
// It has its own ports, so it never attaches to a normal `npm run dev` holding a real library.
const preview = process.env.E2E_PREVIEW === '1'
const port = preview ? 4174 : 5174
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: 'e2e',
  // Specs that need the Firebase emulators run from playwright.emulator.config.ts.
  testIgnore: '**/*.emulator.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL },
  webServer: preview
    ? { command: 'npm run build:e2e && npm run preview:e2e', url: baseURL, reuseExistingServer: false, timeout: 120_000 }
    : { command: 'npm run dev:e2e', url: baseURL, reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
})
