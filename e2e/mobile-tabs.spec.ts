import { expect, test } from '@playwright/test'

test.describe('phone bottom tabs', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Bottom tabs are phone-only')
    await page.goto('/')
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

  test('hide on projector and stage', async ({ page }) => {
    const tabs = page.locator('.phone-tabs')
    await expect(tabs).toBeVisible()

    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Projector' }).click()
    await expect(page.locator('.projector')).toBeVisible()
    await expect(tabs).toBeHidden()
    await page.getByRole('button', { name: 'Exit' }).click()
    await expect(tabs).toBeVisible()

    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Stage' }).click()
    await expect(page.locator('.stage')).toBeVisible()
    await expect(tabs).toBeHidden()
    await page.getByRole('button', { name: 'Exit' }).click()
    await expect(tabs).toBeVisible()
  })
})