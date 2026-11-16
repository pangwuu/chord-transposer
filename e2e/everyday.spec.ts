import { expect, type Page, test } from '@playwright/test'
import { addToSetlist, openFirstSong } from './helpers'

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768

async function nav(page: Page, name: 'Songs' | 'Setlists' | 'Settings') {
  if (isPhone(page)) await page.locator('.phone-tabs').getByRole('button', { name }).click()
  else if (name !== 'Songs') await page.locator('.side-nav').getByRole('button', { name }).click()
}

async function editorAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}

const songTitles = (page: Page) => page.locator('.song-row strong').allTextContents()

/** Imports a pasted chart under a title and lands in the editor on it. */
async function importSong(page: Page, title: string, text = '[Verse 1]\nC        F       G      C\nZebras in the morning light\n') {
  await nav(page, 'Songs')
  await page.locator(isPhone(page) ? '.library' : '.side-nav').getByRole('button', { name: isPhone(page) ? 'Paste a chart' : 'Import' }).click()
  await page.getByLabel('Source text').fill(text)
  await page.getByLabel('Imported title').fill(title)
}

/** On a phone the Setlists tab shows either the list or the setlist left open. */
async function openSetlist(page: Page, name: string) {
  const pick = page.locator('.setlist-pick', { hasText: name })
  if (await pick.isVisible()) await pick.click()
  await expect(page.getByLabel('Setlist name')).toHaveValue(name)
}

async function newSetlist(page: Page, name: string, songs: string[]) {
  await nav(page, 'Setlists')
  await page.getByRole('button', { name: '+ New setlist' }).click()
  await page.getByLabel('Setlist name').fill(name)
  for (const song of songs) await addToSetlist(page, song)
}

test('sorts the song list, reverses it, and keeps the choice after a reload', async ({ page }) => {
  await page.goto('/')
  await importSong(page, 'Zebra Song')
  await page.getByRole('button', { name: 'Save song' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('Zebra Song')
  await nav(page, 'Songs')
  expect(await songTitles(page)).toEqual(['Amazing Grace', 'First Light', 'Zebra Song'])

  await page.getByLabel('Sort songs').selectOption('key')
  expect(await songTitles(page)).toEqual(['Zebra Song', 'Amazing Grace', 'First Light'])
  await page.getByLabel('Sort songs').selectOption('added')
  expect(await songTitles(page)).toEqual(['Zebra Song', 'Amazing Grace', 'First Light'])
  await page.getByLabel('Sort songs').selectOption('title')
  await page.getByRole('button', { name: 'Reverse order' }).click()
  expect(await songTitles(page)).toEqual(['Zebra Song', 'First Light', 'Amazing Grace'])

  await page.reload()
  await nav(page, 'Songs')
  await expect(page.getByRole('button', { name: 'Reverse order' })).toHaveAttribute('aria-pressed', 'true')
  expect(await songTitles(page)).toEqual(['Zebra Song', 'First Light', 'Amazing Grace'])

  // The setlist "Add song" box lists the library the same way.
  await nav(page, 'Setlists')
  await page.getByRole('button', { name: '+ New setlist' }).click()
  await page.getByRole('combobox', { name: 'Add a song' }).click()
  await expect(page.locator('.add-song-option strong')).toHaveText(['Zebra Song', 'First Light', 'Amazing Grace'])
})

test('points a new band at pasting a chart, until it has a song of its own', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('note', { name: 'Bring in your first song' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Paste a chart' }).click()
  await expect(page.getByLabel('Source text')).toBeVisible()

  await page.getByLabel('Source text').fill('[Verse 1]\nC        F       G      C\nZebras in the morning light\n')
  await page.getByLabel('Imported title').fill('Our Own Song')
  await page.getByRole('button', { name: 'Save song' }).click()
  await nav(page, 'Songs')
  await expect(page.getByRole('button', { name: /Our Own Song/ })).toBeVisible()
  await expect(card).toHaveCount(0)
})

test('keeps the first-song card dismissed after a reload', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('note', { name: 'Bring in your first song' })
  await card.getByRole('button', { name: 'Dismiss the first song hint' }).click()
  await expect(card).toHaveCount(0)
  await page.reload()
  await nav(page, 'Songs')
  await expect(page.getByRole('button', { name: /Amazing Grace/ })).toBeVisible()
  await expect(card).toHaveCount(0)
})

test('undoing a deleted song puts it back in its setlist, with its key and notes', async ({ page }) => {
  await page.goto('/')
  await newSetlist(page, 'Sunday', ['First Light', 'Amazing Grace'])
  await page.getByLabel('Key for Amazing Grace').selectOption('A')
  await page.getByRole('button', { name: 'Actions for Amazing Grace' }).click()
  await page.getByRole('menuitem', { name: 'Notes' }).click()
  await page.getByLabel('Notes', { exact: true }).fill('Start soft')

  await nav(page, 'Songs')
  await page.locator('.song-row', { hasText: 'Amazing Grace' }).click()
  await editorAction(page, 'Delete song')
  await expect(page.getByRole('status')).toContainText('Deleted ‘Amazing Grace’')
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('Amazing Grace')

  await nav(page, 'Setlists')
  await openSetlist(page, 'Sunday')
  const rows = page.locator('.setlist-song-title')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('First Light')
  await expect(rows.nth(1)).toContainText('Amazing Grace')
  await expect(rows.nth(1)).toContainText('Start soft')
  await expect(page.getByLabel('Key for Amazing Grace')).toHaveValue('A')
})

test('a message with nothing to undo has no Undo button', async ({ page }) => {
  await page.goto('/')
  await newSetlist(page, 'Easter', [])
  await nav(page, 'Songs')
  await page.locator('.song-row', { hasText: 'Amazing Grace' }).click()
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Add to Setlist…' }).click()
  await expect(page.getByRole('menu')).toContainText('Not played yet')
  await page.getByRole('menuitem', { name: /Easter/ }).click()
  const status = page.getByRole('status')
  await expect(status).toContainText('Added to Easter')
  await expect(status.getByRole('button', { name: 'Undo' })).toHaveCount(0)
})

test('copies the running order as text for the band chat', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await newSetlist(page, 'Sunday', ['Amazing Grace', 'First Light'])
  await page.getByLabel('Key for First Light').selectOption('D')
  await page.getByRole('button', { name: 'Actions for First Light' }).click()
  await page.getByRole('menuitem', { name: 'Capo' }).click()
  await page.getByLabel('Capo for First Light').selectOption('2')
  await page.getByRole('button', { name: 'Setlist actions' }).click()
  await page.getByRole('menuitem', { name: 'Copy running order' }).click()
  await expect(page.getByRole('status')).toContainText('Running order copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Sunday\n1. Amazing Grace — G\n2. First Light — D, capo 2 (C shapes)')
})

test('shows a setlist entry\'s notes, and the chords used, on stage', async ({ page }) => {
  await page.goto('/')
  await newSetlist(page, 'Sunday', ['Amazing Grace'])
  await page.getByRole('button', { name: 'Actions for Amazing Grace' }).click()
  await page.getByRole('menuitem', { name: 'Notes' }).click()
  await page.getByLabel('Notes', { exact: true }).fill('Capo 4 for acoustic')
  await page.getByRole('button', { name: 'Perform' }).click()
  await expect(page.locator('.stage-notes')).toHaveText('Capo 4 for acoustic')
  await expect(page.getByLabel('Chords used')).toHaveText('GG7CEmA7DD7')
  await page.getByRole('button', { name: 'Easy', exact: true }).click()
  await expect(page.getByLabel('Chords used')).toHaveText('GCEmAD')
  await page.getByRole('button', { name: 'Exit' }).click()
})

test('shows easy chords in the editor without changing the song', async ({ page }) => {
  await openFirstSong(page)
  const seventh = page.getByRole('button', { name: 'Chord G7 over "grace,"' })
  await expect(seventh).toBeVisible()
  await page.locator('.editor').getByRole('button', { name: 'Easy', exact: true }).click()
  await expect(seventh).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Chord G over "grace,"' })).toBeVisible()
  // The chord editor opens on the real chord, so an edit can never save the simplified one.
  await page.getByRole('button', { name: 'Chord G over "grace,"' }).click()
  await expect(page.getByLabel('Chord name')).toHaveValue('G7')
  await page.locator('.editor').getByRole('button', { name: 'Easy', exact: true }).click()
  await expect(seventh).toBeVisible()
})

test('replacing a duplicate on import keeps the song in its setlists', async ({ page }) => {
  await page.goto('/')
  await newSetlist(page, 'Sunday', ['Amazing Grace'])
  await importSong(page, 'amazing  grace!')
  const note = page.locator('.duplicate-note')
  await expect(note).toContainText('You already have Amazing Grace (G')

  // Cancelling the confirmation changes nothing.
  page.once('dialog', (dialog) => void dialog.dismiss())
  await note.getByRole('button', { name: 'Replace it' }).click()
  await expect(page.getByLabel('Imported title')).toBeVisible()

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('Replace “Amazing Grace”')
    void dialog.accept()
  })
  await note.getByRole('button', { name: 'Replace it' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('amazing  grace!')
  await nav(page, 'Songs')
  await expect(page.locator('.song-row')).toHaveCount(2)
  await nav(page, 'Setlists')
  await openSetlist(page, 'Sunday')
  await expect(page.locator('.setlist-song-title')).toContainText('amazing grace!')
})

test('keeping both on import makes a second song', async ({ page }) => {
  await page.goto('/')
  await importSong(page, 'The Amazing Grace')
  await page.locator('.duplicate-note').getByRole('button', { name: 'Keep both' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('The Amazing Grace')
  await nav(page, 'Songs')
  await expect(page.locator('.song-row')).toHaveCount(3)
})

test('an import with a new title shows no duplicate warning', async ({ page }) => {
  await page.goto('/')
  await importSong(page, 'Amazing Grace (My Chains Are Gone)')
  await expect(page.getByLabel('Imported title')).toHaveValue('Amazing Grace (My Chains Are Gone)')
  await expect(page.locator('.duplicate-note')).toHaveCount(0)
})

test('keeps the Add song options on screen above where a phone keyboard opens', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The sheet is for phones')
  await page.goto('/')
  await nav(page, 'Setlists')
  await page.getByRole('button', { name: '+ New setlist' }).click()
  await addToSetlist(page, 'Amazing Grace')
  await addToSetlist(page, 'First Light')
  const box = page.getByRole('combobox', { name: 'Add a song' })
  await box.click()
  const options = page.locator('.add-song-option')
  await expect(options.first()).toBeVisible()
  const height = page.viewportSize()!.height
  const input = (await box.boundingBox())!
  const first = (await options.first().boundingBox())!
  // The box sits at the top with the songs straight under it: the top half stays clear of a keyboard.
  expect(input.y).toBeLessThan(40)
  expect(first.y + first.height).toBeLessThan(height / 2)
  await expect(page.getByRole('option', { name: /Amazing Grace/ })).toContainText('In set')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(options).toHaveCount(0)
})

test('lists the keyboard shortcuts on ?, but not while typing', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'A phone has no keyboard; the menu item is covered below')
  await openFirstSong(page)
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await page.getByLabel('Title').click()
  await page.keyboard.type('?')
  await expect(page.getByLabel('Title')).toHaveValue('Amazing Grace?')
  await expect(sheet).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Amazing Grace')
  await page.getByLabel('Search songs').click()
  await page.keyboard.type('?')
  await expect(sheet).toHaveCount(0)
  await page.getByLabel('Search songs').fill('')

  await page.getByRole('button', { name: 'More actions' }).focus()
  await page.keyboard.press('?')
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText('Search songs')
  await expect(sheet).toContainText('Next section, then the next song')
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More actions' })).toBeFocused()
})

test('opens the keyboard shortcuts from the song menu and from Settings', async ({ page }) => {
  await openFirstSong(page)
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await editorAction(page, 'Keyboard shortcuts')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(sheet).toHaveCount(0)
  await nav(page, 'Settings')
  await page.getByRole('button', { name: 'Show shortcuts' }).click()
  await expect(sheet).toBeVisible()
})

test('reopening stage view picks up at the same section', async ({ page }) => {
  await openFirstSong(page)
  await page.getByRole('button', { name: 'Performance view' }).click()
  await page.getByRole('button', { name: 'Next section' }).click()
  await expect(page.locator('.stage-section.is-current')).toHaveAttribute('data-stage-section', 'Verse 2')
  await page.getByRole('button', { name: 'Exit' }).click()
  await page.getByRole('button', { name: 'Performance view' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Back at Verse 2' })).toBeVisible()
  await expect(page.locator('.stage-section.is-current')).toHaveAttribute('data-stage-section', 'Verse 2')
  await page.getByRole('button', { name: 'Start from the top' }).click()
  await expect(page.locator('.stage-section.is-current')).toHaveAttribute('data-stage-section', 'Verse 1')
})

test('adds a cover page with the running order to a setlist PDF', async ({ page }) => {
  await page.goto('/')
  await newSetlist(page, 'Sunday', ['Amazing Grace', 'First Light'])
  await page.locator('.setlist-actions').getByRole('button', { name: 'Export PDF' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export setlist PDF' })
  const pages = dialog.locator('.paper')
  const before = await pages.count()
  await dialog.getByLabel('Cover page').check()
  await expect(pages).toHaveCount(before + 1)
  await expect(pages.first()).toContainText('Running order')
  await expect(pages.first()).toContainText('First Light')
  await dialog.getByLabel('Show chords used').check()
  await expect(pages.nth(1).locator('.paper-chords')).toContainText('G7')
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download' }).click()
  expect((await download).suggestedFilename()).toBe('Sunday.pdf')
})
