import { expect, test } from '@playwright/test'

test('nudges, adds, edits, deletes, and replaces chords', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('Title')).toHaveValue('Amazing Grace')
  const chord = page.getByRole('button', { name: /^Chord / }).first()
  await chord.click()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('status')).toContainText('Chord moved')
  await page.getByRole('button', { name: 'Undo' }).last().click()

  await page.getByRole('button', { name: 'Chord G7 over "grace,"' }).click({ modifiers: ['Shift'] })
  await expect(page.getByRole('button', { name: 'Edit chord' })).toHaveText('2 chords')

  await page.getByLabel('Replace every instance with').fill('G2')
  await page.getByRole('button', { name: /Replace every / }).click()
  await expect(page.getByRole('status')).toContainText('Replaced')

  await page.locator('.letter').nth(4).click()
  const field = page.getByLabel('Chord name')
  await expect(field).toBeFocused()
  await field.fill('D')
  await field.press('Enter')
  await expect(page.getByRole('button', { name: 'Chord D over "ing"' })).toBeVisible()
  await page.getByRole('button', { name: 'Chord D over "ing"' }).click()
  await page.keyboard.press('Delete')
  await expect(page.getByRole('status')).toContainText('Deleted')
})

test('shows ChordPro beside the chart and opens import review', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'ChordPro' }).click()
  await expect(page.getByLabel('ChordPro source')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Chord / }).first()).toBeVisible()
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Songs' }).click()
  await page.getByRole('button', { name: 'Import' }).click()
  await page.getByLabel('Source text').fill('{title: Kitchen}\n{key: G}\n[G]Morning [D]light\n')
  await expect(page.getByText('2 chords')).toBeVisible()
  await page.getByRole('button', { name: 'Save song' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('Kitchen')
})

test('walks a setlist on stage', async ({ page }, testInfo) => {
  await page.goto('/')
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Songs' }).click()
  const setlists = testInfo.project.name === 'mobile' ? page.locator('.phone-tabs').getByRole('button', { name: 'Setlists' }) : page.locator('.side-nav').getByRole('button', { name: 'Setlists' })
  await setlists.click()
  await page.getByRole('button', { name: '+ New setlist' }).click()
  await page.getByLabel('Add a song to Sunday').selectOption({ label: 'Amazing Grace' })
  await page.getByLabel('Add a song to Sunday').selectOption({ label: 'First Light' })
  await page.getByRole('button', { name: 'Stage' }).click()
  await page.getByRole('button', { name: 'Next song' }).click()
  await expect(page.locator('.stage strong')).toHaveText('First Light')
  await page.getByRole('button', { name: 'Exit' }).click()
})

test('registers a service worker in the installed app', async ({ page }) => {
  test.skip(process.env.E2E_PREVIEW !== '1', 'The dev server does not install the offline worker')
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.getRegistrations().then((regs) => regs.length > 0))
})
