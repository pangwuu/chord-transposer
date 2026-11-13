import { expect, type Page, test } from '@playwright/test'
import { firstLight } from '../src/fixtures/charts'
import { bundleSetlist, encodeBundle, encodeShare } from '../src/domain/share'
import { openFirstSong } from './helpers'

function phone(page: Page) {
  return (page.viewportSize()?.width ?? 1280) < 768
}

async function openSong(page: Page, name: RegExp) {
  if (phone(page)) await page.getByRole('button', { name: 'Back to songs' }).click()
  await page.getByRole('button', { name }).click()
}

test('each song has its own address, which survives a reload', async ({ page }) => {
  await openFirstSong(page)
  await expect(page).toHaveURL(/#\/song\/.+/)
  const first = page.url()
  await openSong(page, /First Light/)
  await expect(page.getByLabel('Title')).toHaveValue('First Light')
  await expect(page).toHaveURL(/#\/song\/.+/)
  expect(page.url()).not.toBe(first)
  await page.reload()
  await expect(page.getByLabel('Title')).toHaveValue('First Light')
})

test('back and forward move between songs', async ({ page }) => {
  test.skip(phone(page), 'A phone passes through the song list between songs')
  await openFirstSong(page)
  await expect(page.getByLabel('Title')).toHaveValue('Amazing Grace')
  await openSong(page, /First Light/)
  await expect(page.getByLabel('Title')).toHaveValue('First Light')
  await page.goBack()
  await expect(page.getByLabel('Title')).toHaveValue('Amazing Grace')
  await page.goForward()
  await expect(page.getByLabel('Title')).toHaveValue('First Light')
})

test('back on a phone returns from a song to the song list', async ({ page }) => {
  test.skip(!phone(page), 'Only a phone has a song list screen')
  await openFirstSong(page)
  await expect(page.getByLabel('Title')).toBeVisible()
  await page.goBack()
  await expect(page.getByLabel('Title')).toBeHidden()
  await expect(page.getByRole('button', { name: /First Light/ })).toBeVisible()
  await expect(page).toHaveURL(/#\/songs$/)
})

test('a setlist has its own address, which survives a reload', async ({ page }) => {
  const song = { ...firstLight, id: 'shared-song', title: 'Shared Song' }
  const encoded = encodeBundle(bundleSetlist({ id: 'shared-set', name: 'Shared Sunday', date: '', entries: [{ songId: 'shared-song' }] }, [song]))
  if (!encoded.ok) throw new Error('Fixture too large to share')
  await page.goto(`/#${encoded.hash}`)
  await expect(page).toHaveURL(/#\/setlist\/shared-set$/)
  await page.reload()
  await expect(page.getByLabel('Setlist name')).toHaveValue('Shared Sunday')
  await page.goto('about:blank')
  await page.goto('/#/settings')
  await expect(page.getByLabel('Restore backup')).toBeAttached()
})

test('a share link pasted into the open app adds the song', async ({ page }) => {
  await openFirstSong(page)
  await expect(page.getByLabel('Title')).toHaveValue('Amazing Grace')
  const encoded = encodeShare({ ...firstLight, id: 'pasted-song', title: 'Pasted Song' })
  if (!encoded.ok) throw new Error('Fixture too large to share')
  await page.evaluate((hash) => { location.hash = hash }, encoded.hash)
  await expect(page.getByLabel('Title')).toHaveValue('Pasted Song')
  await expect(page).toHaveURL(/#\/song\/pasted-song$/)
})

test('an address for a song that is not here says so', async ({ page }) => {
  await page.goto('/#/song/not-on-this-device')
  await expect(page.getByRole('status')).toContainText('That song is not in this library')
  await expect(page).not.toHaveURL(/not-on-this-device/)
})
