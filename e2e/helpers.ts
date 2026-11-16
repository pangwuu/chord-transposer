import type { Page } from '@playwright/test'

/** Load the app with a song open. A phone starts on the song list, so tap one. */
export async function openFirstSong(page: Page) {
  await page.goto('/')
  const width = page.viewportSize()?.width ?? 1280
  if (width < 768) await page.getByRole('button', { name: /Amazing Grace/ }).click()
}

/** Adds a song to the open setlist by searching for it, as a person would. */
export async function addToSetlist(page: Page, title: string) {
  await page.getByRole('combobox', { name: 'Add a song' }).fill(title)
  await page.getByRole('option', { name: new RegExp(title) }).click()
  // On a phone the songs open as a sheet that stays up for the next song: close it to see the setlist.
  const done = page.locator('.add-song.is-sheet').getByRole('button', { name: 'Done' })
  if (await done.isVisible()) await done.click()
}
