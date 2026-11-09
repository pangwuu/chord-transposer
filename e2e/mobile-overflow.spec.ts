import { expect, type Page, test } from '@playwright/test'

/** True when a panel's content is wider than the panel (horizontal overflow). */
async function panelOverflows(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return { missing: true as const, scrollWidth: 0, clientWidth: 0 }
    return {
      missing: false as const,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }
  }, selector)
}

test('keeps setlists and settings inside the phone width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone overflow only')

  await page.goto('/')
  await page.locator('.phone-tabs').getByRole('button', { name: 'Setlists' }).click()
  await page.getByRole('button', { name: '+ New setlist' }).click()
  await page.getByLabel(/Add a song to/).selectOption({ label: 'Amazing Grace' })
  await page.getByLabel(/Add a song to/).selectOption({ label: 'First Light' })

  const setlists = await panelOverflows(page, '.setlists')
  expect(setlists.missing).toBe(false)
  expect(
    setlists.scrollWidth,
    `setlists overflow: ${setlists.scrollWidth} > ${setlists.clientWidth}`,
  ).toBeLessThanOrEqual(setlists.clientWidth)

  await page.locator('.phone-tabs').getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  const settings = await panelOverflows(page, '.settings')
  expect(settings.missing).toBe(false)
  expect(
    settings.scrollWidth,
    `settings overflow: ${settings.scrollWidth} > ${settings.clientWidth}`,
  ).toBeLessThanOrEqual(settings.clientWidth)
})
