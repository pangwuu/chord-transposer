import { defineConfig } from 'vitest/config'

// Tests that need the Firebase emulators. Run them with `npm run test:emulator`, which starts the emulators first.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.emulator.test.ts'],
    fileParallelism: false,
  },
})
