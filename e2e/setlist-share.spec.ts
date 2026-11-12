import { expect, type Page, test } from '@playwright/test'
import { firstLight } from '../src/fixtures/charts'
import type { Setlist } from '../src/domain/library-types'
import { bundleSetlist, encodeBundle, encodeShare, readShare } from '../src/domain/share'

const sharedSong = { ...firstLight, id: 'shared-song', title: 'Shared Song', updatedAt: '2026-01-01T00:00:00.000Z' }
const sharedSet: Setlist = { id: 'shared-set', name: 'Shared Sunday', date: '2026-03-01', entries: [{ songId: 'shared-song', capo: 2 }] }

function link(setlist: Setlist, songs = [sharedSong]) {
  const encoded = encodeBundle(bundleSetlist(setlist, songs))
  if (!encoded.ok) throw new Error('Fixture too large to share')
  return `/#${encoded.hash}`
}

async function nav(page: Page, name: string) {
  const mobile = (page.viewportSize()?.width ?? 1280) < 768
  await page.locator(mobile ? '.phone-tabs' : '.side-nav').getByRole('button', { name }).click()
}

test('a setlist link opens the setlist with its songs, and can be shared on', async ({ page }) => {
  await page.goto(link(sharedSet))
  await expect(page.getByLabel('Setlist name')).toHaveValue('Shared Sunday')
  await expect(page.locator('.setlist-song-title')).toContainText('Shared Song')
  await expect(page.locator('.setlist-song-title')).toContainText('Capo 2')
  await expect(page).toHaveURL(/#\/setlist\/shared-set$/)

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Setlist actions' }).click()
  await page.getByRole('menuitem', { name: 'Copy share link' }).click()
  await expect(page.getByRole('status')).toContainText('Share link copied')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  const bundle = readShare(copied.slice(copied.indexOf('#') + 1))
  expect(bundle.setlist?.name).toBe('Shared Sunday')
  expect(bundle.songs.map((song) => song.title)).toEqual(['Shared Song'])
})

test('a setlist file downloads and imports', async ({ page }) => {
  await page.goto(link(sharedSet))
  await expect(page.getByLabel('Setlist name')).toHaveValue('Shared Sunday')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Setlist actions' }).click()
  await page.getByRole('menuitem', { name: 'Download file' }).click()
  expect((await download).suggestedFilename()).toBe('Shared Sunday.setlist.json')

  if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole('button', { name: '‹ Setlists' }).click()
  const other = bundleSetlist({ ...sharedSet, id: 'other-set', name: 'Midweek' }, [sharedSong])
  await page.getByLabel('Import setlist file').setInputFiles({ name: 'Midweek.setlist.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(other)) })
  await expect(page.getByRole('status')).toContainText('Added setlist “Midweek”')
  await expect(page.getByLabel('Setlist name')).toHaveValue('Midweek')
})

test('a newer shared song replaces the local copy only when accepted', async ({ page }) => {
  const first = encodeShare(sharedSong)
  const fixed = encodeShare({ ...sharedSong, title: 'Shared Song (fixed)', updatedAt: '2026-02-01T00:00:00.000Z' })
  if (!first.ok || !fixed.ok) throw new Error('Fixture too large to share')
  await page.goto(`/#${first.hash}`)
  await expect(page.getByLabel('Title')).toHaveValue('Shared Song')

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('Shared Song (fixed)')
    void dialog.accept()
  })
  await page.goto('about:blank')
  await page.goto(`/#${fixed.hash}`)
  await expect(page.getByLabel('Title')).toHaveValue('Shared Song (fixed)')
})

test('restoring a backup keeps the setlists already here', async ({ page }) => {
  await page.goto(link(sharedSet))
  await expect(page.getByLabel('Setlist name')).toHaveValue('Shared Sunday')
  const backup = { version: 1, songs: [], setlists: [{ id: 'backup-set', name: 'From backup', date: '', entries: [] }] }
  await nav(page, 'Settings')
  await page.getByLabel('Restore backup').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.getByRole('status')).toContainText('Backup restored')
  await nav(page, 'Setlists')
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole('button', { name: '‹ Setlists' }).click()
  await expect(page.getByRole('button', { name: /Shared Sunday/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /From backup/ })).toBeVisible()
})
