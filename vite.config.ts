import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'fonts/*'],
      manifest: {
        name: 'Chord Sheet Maker',
        short_name: 'Charts',
        description: 'Edit, transpose, and print chord charts on this device.',
        display: 'standalone',
        share_target: { action: '/', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        background_color: '#ffffff',
        theme_color: '#7540E6',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ttf,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Emulator-backed tests need a backend: `npm run test:emulator`.
    exclude: [...configDefaults.exclude, 'src/**/*.emulator.test.ts'],
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
  },
})
