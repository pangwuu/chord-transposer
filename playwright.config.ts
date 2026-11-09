import { defineConfig, devices } from '@playwright/test'

const preview = process.env.E2E_PREVIEW === '1'
const port = preview ? 4173 : 5173
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL },
  webServer: preview
    ? { command: 'npm run preview', url: baseURL, reuseExistingServer: false }
    : { command: 'npm run dev', url: baseURL, reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
})
