import { expect, type Page, test } from '@playwright/test'

function mobile(name: string) {
  return name === 'mobile'
}

async function songs(page: Page, project: string) {
  if (mobile(project)) await page.locator('.phone-tabs').getByRole('button', { name: 'Songs' }).click()
}

async function editorAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
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
  await page.getByLabel('Capo', { exact: true }).selectOption('4')
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

test('keeps bar-line chords on the bar line', async ({ page }, testInfo) => {
  await page.goto('/')
  await songs(page, testInfo.project.name)
  await page.getByRole('button', { name: 'First Light' }).click()
  const bars = page.locator('.section', { has: page.getByLabel('Intro name') }).locator('.bars')
  const chord = bars.getByRole('button', { name: 'D/F#' })
  await expect(chord).toBeVisible()
  const barBox = await bars.boundingBox()
  const chordBox = await chord.boundingBox()
  expect(barBox).not.toBeNull()
  expect(chordBox).not.toBeNull()
  expect(chordBox!.y).toBeGreaterThanOrEqual(barBox!.y - 2)
  expect(chordBox!.y + chordBox!.height).toBeLessThanOrEqual(barBox!.y + barBox!.height + 2)
  const header = page.locator('.editor-bar')
  const headerBox = await header.boundingBox()
  expect(chordBox!.y).toBeGreaterThan((headerBox?.y ?? 0) + (headerBox?.height ?? 0))
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
  await expect(page.locator('.bars').getByRole('button', { name: 'C', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Verse 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Verse 1 ×2' })).toBeVisible()
})

test('keeps a ChordPro edit and the chart in sync', async ({ page }) => {
  await page.goto('/')
  await editorAction(page, 'Use ChordPro Editor')
  const source = page.getByLabel('ChordPro source')
  await expect(source).toBeVisible()
  await expect(page.getByRole('button', { name: /^Chord / }).first()).toBeVisible()
  await source.fill('{title: Kitchen}\n{key: C}\n[C]Hello there\n')
  await expect(page.getByLabel('Title')).toHaveValue('Kitchen')
  await expect(page.getByRole('button', { name: /Chord C / }).first()).toBeVisible()
  await editorAction(page, 'Use Visual Editor')
  await expect(source).toHaveCount(0)
})

test('adds a chord to an imported instrumental and saves it', async ({ page }, testInfo) => {
  await page.goto('/')
  await songs(page, testInfo.project.name)
  await page.getByRole('button', { name: 'Import' }).click()
  await page.getByLabel('Source text').fill('Intro\nG    D    Em    C\n')
  const bars = page.locator('.bars')
  await expect(bars.getByRole('button', { name: 'C', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Add chord' }).click()
  await expect(bars.getByRole('button', { name: 'C', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Save song' }).click()
  await expect(page.locator('.bars').getByRole('button', { name: 'C', exact: true })).toHaveCount(2)
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

test('reviews a song beside its source with save kept in reach', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: mobile(testInfo.project.name) ? 390 : 1280, height: 800 })
  await page.goto('/')
  await songs(page, testInfo.project.name)
  await page.getByRole('button', { name: 'Import' }).click()
  await page.getByLabel('Source text').fill('{title: Kitchen}\n{key: G}\n[G]Morning [D]light\n')
  await expect(page.getByText('All chords read')).toBeVisible()
  await expect(page.getByText(/is kept as written/)).toHaveCount(0)

  const source = page.getByLabel('Source text')
  const chord = page.getByRole('button', { name: /Chord G / })
  const save = page.getByRole('button', { name: 'Save song' })
  const sourceBox = await source.boundingBox()
  const chordBox = await chord.boundingBox()
  const saveBox = await save.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(chordBox).not.toBeNull()
  expect(saveBox).not.toBeNull()
  if (mobile(testInfo.project.name)) {
    expect(chordBox!.y).toBeGreaterThan(sourceBox!.y)
    const tabs = await page.locator('.phone-tabs').boundingBox()
    expect(tabs).not.toBeNull()
    expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(tabs!.y + 1)
  } else {
    expect(chordBox!.x).toBeGreaterThan(sourceBox!.x + sourceBox!.width - 8)
    const screen = await page.locator('.import-screen').boundingBox()
    const library = await page.locator('.library').boundingBox()
    expect(screen).not.toBeNull()
    expect(library).not.toBeNull()
    expect(screen!.width).toBeGreaterThan(900)
    expect(screen!.x).toBeGreaterThanOrEqual(library!.x + library!.width - 2)
  }
  const overflow = await page.locator('.import-screen').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
  expect(overflow).toBe(true)
})

test('scrolls a setlist export when the pages run past the window', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: testInfo.project.name === 'mobile' ? 390 : 1280, height: 640 })
  await page.goto('/')
  const setlists =
    testInfo.project.name === 'mobile'
      ? page.locator('.phone-tabs').getByRole('button', { name: 'Setlists' })
      : page.locator('.side-nav').getByRole('button', { name: 'Setlists' })
  await setlists.click()
  await page.getByRole('button', { name: '+ New setlist' }).click()
  await page.getByLabel('Add a song to Sunday').selectOption({ label: 'Amazing Grace' })
  await page.getByLabel('Add a song to Sunday').selectOption({ label: 'First Light' })
  await page.getByRole('button', { name: 'Export PDF' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export setlist PDF' })
  await expect(dialog).toBeVisible()
  await dialog.locator('.paper').first().hover({ position: { x: 40, y: 80 } })
  await dialog.evaluate((el) => {
    el.scrollTop = Math.max(0, el.scrollTop - 220)
  })
  const parked = await dialog.evaluate((el) => el.scrollTop)
  await page.mouse.wheel(0, 400)
  await expect.poll(async () => dialog.evaluate((el) => el.scrollTop), { message: `parked ${parked}` }).toBeGreaterThan(parked + 40)
  await expect(dialog.getByRole('button', { name: 'Download' })).toBeInViewport()
})

test('previews a song PDF beside the export settings and scrolls it', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: testInfo.project.name === 'mobile' ? 390 : 1280, height: 640 })
  await page.goto('/')
  if (mobile(testInfo.project.name)) await page.getByRole('button', { name: 'Preview' }).click()
  await page.getByRole('button', { name: 'Export PDF' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export PDF' })
  const paper = dialog.locator('.paper').first()
  const paperChoice = dialog.getByLabel('Paper')
  await expect(paper.getByRole('heading', { name: 'Amazing Grace' })).toBeVisible()
  await expect(paperChoice).toBeVisible()
  const paperBox = await paper.boundingBox()
  const choiceBox = await paperChoice.boundingBox()
  expect(paperBox).not.toBeNull()
  expect(choiceBox).not.toBeNull()
  if (mobile(testInfo.project.name)) expect(paperBox!.y).toBeGreaterThan(choiceBox!.y)
  else expect(paperBox!.x).toBeGreaterThan(choiceBox!.x + choiceBox!.width)
  await paper.hover({ position: { x: 40, y: 80 } })
  await dialog.evaluate((el) => {
    el.scrollTop = Math.max(0, el.scrollTop - 220)
  })
  const parked = await dialog.evaluate((el) => el.scrollTop)
  await page.mouse.wheel(0, 400)
  await expect.poll(async () => dialog.evaluate((el) => el.scrollTop), { message: `parked ${parked}` }).toBeGreaterThan(parked + 40)
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

test('pads the export Cancel and Download actions evenly', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: testInfo.project.name === 'mobile' ? 390 : 1280, height: 640 })
  await page.goto('/')
  if (mobile(testInfo.project.name)) await page.getByRole('button', { name: 'Preview' }).click()
  await page.getByRole('button', { name: 'Export PDF' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export PDF' })
  const actions = dialog.locator('.row-meta')
  const cancel = dialog.getByRole('button', { name: 'Cancel' })
  const download = dialog.getByRole('button', { name: 'Download' })
  await dialog.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const dialogBox = await dialog.boundingBox()
  const actionsBox = await actions.boundingBox()
  const cancelBox = await cancel.boundingBox()
  const downloadBox = await download.boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(actionsBox).not.toBeNull()
  expect(cancelBox).not.toBeNull()
  expect(downloadBox).not.toBeNull()
  const left = cancelBox!.x - dialogBox!.x
  const right = dialogBox!.x + dialogBox!.width - (downloadBox!.x + downloadBox!.width)
  const top = downloadBox!.y - actionsBox!.y
  const bottom = dialogBox!.y + dialogBox!.height - (downloadBox!.y + downloadBox!.height)
  expect(left).toBeGreaterThanOrEqual(14)
  expect(right).toBeGreaterThanOrEqual(14)
  expect(top).toBeGreaterThanOrEqual(14)
  expect(bottom).toBeGreaterThanOrEqual(14)
  expect(Math.abs(left - right)).toBeLessThan(4)
  expect(Math.abs(top - bottom)).toBeLessThan(6)
})

test('steps a projector slide and leaves the stage', async ({ page }) => {
  await page.goto('/')
  await editorAction(page, 'Projector View')
  await expect(page.locator('.projector')).toContainText('Amazing grace')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.projector')).toContainText('grace that taught')
  await page.getByRole('button', { name: 'Exit' }).click()
  await expect(page.locator('.projector')).toHaveCount(0)
  await editorAction(page, 'Performance View')
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

test('deletes the open song from the menu after confirmation', async ({ page }, testInfo) => {
  await page.goto('/')
  await songs(page, testInfo.project.name)
  await page.getByRole('button', { name: '+ New song' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('Untitled song')
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toMatch(/Delete song “Untitled song”/)
    void dialog.accept()
  })
  await editorAction(page, 'Delete song')
  await songs(page, testInfo.project.name)
  await expect(page.getByRole('button', { name: /Untitled song/ })).toHaveCount(0)
  await expect(page.getByLabel('Title')).not.toHaveValue('Untitled song')
})

test('keeps the setlist when delete confirmation is cancelled', async ({ page }, testInfo) => {
  await page.goto('/')
  const setlists =
    testInfo.project.name === 'mobile'
      ? page.locator('.phone-tabs').getByRole('button', { name: 'Setlists' })
      : page.locator('.side-nav').getByRole('button', { name: 'Setlists' })
  await setlists.click()
  await page.getByRole('button', { name: '+ New setlist' }).click()
  await expect(page.getByLabel('Setlist name')).toHaveValue('Sunday')
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toMatch(/Delete setlist “Sunday”/)
    void dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Setlist actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByLabel('Setlist name')).toHaveValue('Sunday')
})

test('copies a share link and downloads a ChordPro file', async ({ page }) => {
  await page.goto('/')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await editorAction(page, 'Copy Share Link')
  await expect(page.getByRole('status')).toContainText('Share link copied')
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('#1.')
  const download = page.waitForEvent('download')
  await editorAction(page, 'Download as ChordPro')
  expect((await download).suggestedFilename()).toBe('Amazing Grace.cho')
})

test('does not show capo chips or per-line Edit lyric', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Capo \d+ ·/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit lyric' })).toHaveCount(0)
})
