import { expect, test } from '@playwright/test'
import { firstLight } from '../src/fixtures/charts'
import { encodeShare } from '../src/domain/share'
import { openFirstSong } from './helpers'

test.describe('phone start screen', () => {
  test.skip(({ isMobile }) => !isMobile, 'The song list only leads on a phone')

  test('opens on all songs', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Amazing Grace/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /First Light/ })).toBeVisible()
    await expect(page.getByLabel('Title')).toBeHidden()
    await expect(page.locator('.phone-tabs').getByRole('button', { name: 'Songs' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('opens a shared song straight in the editor', async ({ page }) => {
    const shared = encodeShare({ ...firstLight, id: 'shared-song', title: 'Shared Song' })
    if (!shared.ok) throw new Error('Fixture too large to share')
    await page.goto(`/#${shared.hash}`)
    await expect(page.getByLabel('Title')).toBeVisible()
    await expect(page.getByLabel('Title')).toHaveValue('Shared Song')
  })
})

test.describe('phone bottom tabs', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Bottom tabs are phone-only')
    await openFirstSong(page)
  })

  test('stay on the editor and jump to setlists', async ({ page }) => {
    await expect(page.getByLabel('Title')).toHaveValue('Amazing Grace')
    const tabs = page.locator('.phone-tabs')
    await expect(tabs).toBeVisible()
    await expect(tabs.getByRole('button', { name: 'Songs' })).toHaveAttribute('aria-pressed', 'true')
    await tabs.getByRole('button', { name: 'Setlists' }).click()
    await expect(page.getByRole('button', { name: '+ New setlist' })).toBeVisible()
    await expect(tabs.getByRole('button', { name: 'Setlists' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('more-actions menu is hittable and not clipped', async ({ page }) => {
    await page.getByRole('button', { name: 'More actions' }).click()
    await expect(page.getByRole('button', { name: 'More actions' })).toHaveAttribute('aria-expanded', 'true')
    const stageItem = page.getByRole('menuitem', { name: 'Projector View' })
    await expect(stageItem).toBeVisible()
    const hit = await stageItem.evaluate((node) => {
      const box = node.getBoundingClientRect()
      const el = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return el === node || node.contains(el)
    })
    expect(hit).toBe(true)
  })

  test('hide on projector and stage', async ({ page }) => {
    const tabs = page.locator('.phone-tabs')
    await expect(tabs).toBeVisible()

    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Projector View' }).click()
    await expect(page.locator('.projector')).toBeVisible()
    await expect(tabs).toBeHidden()
    await page.getByRole('button', { name: 'Exit' }).click()
    await expect(tabs).toBeVisible()

    await page.getByRole('button', { name: 'Performance view' }).click()
    await expect(page.locator('.stage')).toBeVisible()
    await expect(tabs).toBeHidden()
    await page.getByRole('button', { name: 'Exit' }).click()
    await expect(tabs).toBeVisible()
  })
})