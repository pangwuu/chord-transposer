import { expect, type Page, test } from '@playwright/test'

function mobile(name: string) {
  return name === 'mobile'
}

async function songs(page: Page, project: string) {
  if (mobile(project)) await page.locator('.phone-tabs').getByRole('button', { name: 'Songs' }).click()
}

async function editorAction(page: Page, project: string, name: string | RegExp) {
  if (mobile(project)) await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole(mobile(project) ? 'menuitem' : 'button', { name }).click()
}

test('transposes, shows capo shapes, and numbers the chords', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('Title')).toHaveValue('Amazing Grace')
  await page.getByRole('button', { name: 'Key up a semitone' }).click()
  await expect(page.getByRole('combobox', { name: 'Key' })).toHaveValue('Ab')
  await expect(page.getByText('From G')).toBeVisible()
  await page.getByRole('button', { name: '1-4-5' }).click()
  await expect(page.getByRole('button', { name: 'Chord Ab over "Amazing"' })).toHaveText('1')
  await page.getByRole('button', { name: '1-4-5' }).click()
  await page.getByLabel('Capo').selectOption({ label: 'Capo 4' })
  await expect(page.getByText('Capo 4 · showing E shapes · sounds in Ab')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chord E over "Amazing"' })).toBeVisible()
  await page.getByRole('button', { name: 'Save as song key' }).click()
  await expect(page.getByText('From G')).toHaveCount(0)
})

test('nudges from the touch toolbar, then undo puts the chord back', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Chord G over "Amazing"' }).click()
  await page.getByRole('button', { name: 'Move right one letter' }).click()
  await expect(page.getByRole('status')).toContainText('Chord moved')
  await expect(page.getByRole('button', { name: 'Chord G over "Amazing"' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).last().click()
  await expect(page.getByRole('button', { name: 'Chord G over "Amazing"' })).toBeVisible()
})

test('drags a chord along the lyric on a wide screen', async ({ page }, testInfo) => {
  test.skip(mobile(testInfo.project.name), 'A finger drag is covered by the toolbar nudge on a phone')
  await page.goto('/')
  const chord = page.getByRole('button', { name: 'Chord G over "Amazing"' })
  await chord.dragTo(page.getByRole('button', { name: 'Add a chord on z' }).first())
  await expect(page.getByRole('status')).toContainText('Chord moved')
  await expect(page.getByRole('button', { name: /Chord G over "z/ })).toBeVisible()
})

test('adds a comment, a bar line, and an arrangement repeat', async ({ page }) => {
  await page.goto('/')
  const comment = page.getByRole('button', { name: 'Comment' }).first()
  await comment.click()
  await expect(page.getByLabel('Comment')).toBeVisible()
  await comment.click()
  await expect(page.getByLabel('Comment')).toHaveCount(0)
  await comment.click()
  await page.getByLabel('Comment').fill('Build')
  await page.getByLabel('Comment').press('Enter')
  await expect(page.locator('.comment').filter({ hasText: 'Build' })).toBeVisible()
  await page.getByRole('button', { name: 'Bars' }).first().click()
  await page.getByLabel('Bar line').fill('| C - - - |')
  await page.getByLabel('Bar line').press('Enter')
  await expect(page.locator('.bars').getByRole('button', { name: 'C' })).toBeVisible()
  await page.getByRole('button', { name: 'Verse 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Verse 1 ×2' })).toBeVisible()
})

test('keeps a ChordPro edit and the chart in sync', async ({ page }, testInfo) => {
  await page.goto('/')
  await editorAction(page, testInfo.project.name, 'ChordPro')
  const source = page.getByLabel('ChordPro source')
  await expect(source).toBeVisible()
  await expect(page.getByRole('button', { name: /^Chord / }).first()).toBeVisible()
  await source.fill('{title: Kitchen}\n{key: C}\n[C]Hello there\n')
  await expect(page.getByLabel('Title')).toHaveValue('Kitchen')
  await expect(page.getByRole('button', { name: /Chord C / }).first()).toBeVisible()
  await editorAction(page, testInfo.project.name, 'Visual')
  await expect(source).toHaveCount(0)
})

test('reviews an import and saves it into the library', async ({ page }, testInfo) => {
  await page.goto('/')
  await songs(page, testInfo.project.name)
  await page.getByRole('button', { name: 'Import' }).click()
  await page.getByLabel('Source text').fill('Verse 1\nC            G\nMorning light falls\n')
  await expect(page.getByText(/\d+ chords/)).toBeVisible()
  await page.getByRole('button', { name: 'Save song' }).click()
  await expect(page.getByLabel('Title')).not.toHaveValue('')
})

test('changes the PDF paper and fit from the export dialog', async ({ page }, testInfo) => {
  await page.goto('/')
  if (mobile(testInfo.project.name)) {
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Export PDF' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Amazing Grace - G.pdf')
  await page.getByLabel('Paper').selectOption('letter')
  await page.getByLabel('Fit to pages').selectOption('1')
  await expect(dialog).toContainText('1 page')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  if (mobile(testInfo.project.name)) {
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByLabel('Title')).toBeVisible()
  }
})

test('steps a projector slide and leaves the stage', async ({ page }, testInfo) => {
  await page.goto('/')
  await editorAction(page, testInfo.project.name, 'Projector')
  await expect(page.locator('.projector')).toContainText('Amazing grace')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.projector')).toContainText('grace that taught')
  await page.getByRole('button', { name: 'Exit' }).click()
  await expect(page.locator('.projector')).toHaveCount(0)
  await editorAction(page, testInfo.project.name, 'Stage')
  await expect(page.locator('.stage')).toContainText('Amazing grace')
  await page.getByRole('button', { name: 'Next section' }).click()
  await page.getByRole('button', { name: 'Exit' }).click()
  await expect(page.locator('.stage')).toHaveCount(0)
})

test('switches theme and finds a song from the library', async ({ page }, testInfo) => {
  await page.goto('/')
  await songs(page, testInfo.project.name)
  const settings = mobile(testInfo.project.name)
    ? page.locator('.phone-tabs').getByRole('button', { name: 'Settings' })
    : page.locator('.side-nav').getByRole('button', { name: 'Settings' })
  await settings.click()
  await page.getByLabel('Theme').selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByLabel('Text size').selectOption('l')
  await expect(page.locator('html')).toHaveAttribute('data-size', 'l')
  if (mobile(testInfo.project.name)) await page.locator('.phone-tabs').getByRole('button', { name: 'Songs' }).click()
  else await page.getByRole('button', { name: /Amazing Grace/ }).click()
  const search = page.getByLabel('Search songs')
  if (mobile(testInfo.project.name)) {
    await search.fill('First')
    await expect(page.getByRole('button', { name: /First Light/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Amazing Grace/ })).toHaveCount(0)
    await page.getByRole('button', { name: '+ New song' }).click()
  } else {
    await search.fill('First')
    await expect(page.getByRole('button', { name: /First Light/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Amazing Grace/ })).toHaveCount(0)
    await search.fill('')
    await page.getByRole('button', { name: '+ New song' }).click()
  }
  await expect(page.getByLabel('Title')).toHaveValue('Untitled song')
})

test('copies a share link and downloads a ChordPro file', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await editorAction(page, testInfo.project.name, 'Share')
  await expect(page.getByRole('status')).toContainText('Share link copied')
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('#1.')
  const download = page.waitForEvent('download')
  await editorAction(page, testInfo.project.name, '.cho')
  expect((await download).suggestedFilename()).toBe('Amazing Grace.cho')
})

test('does not show capo chips or per-line Edit lyric', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Capo \d+ ·/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit lyric' })).toHaveCount(0)
})
