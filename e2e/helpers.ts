import type { Page } from '@playwright/test'

/** Load the app with a song open. A phone starts on the song list, so tap one. */
export async function openFirstSong(page: Page) {
  await page.goto('/')
  const width = page.viewportSize()?.width ?? 1280
  if (width < 768) await page.getByRole('button', { name: /Amazing Grace/ }).click()
}
