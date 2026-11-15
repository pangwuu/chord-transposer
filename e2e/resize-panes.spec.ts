import { expect, test, type Page } from '@playwright/test'
import { openFirstSong } from './helpers'

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1200, 'Panes are resized on desktop only')

const widthOf = (page: Page, selector: string) => page.locator(selector).evaluate((element) => Math.round(element.getBoundingClientRect().width))

async function drag(page: Page, name: string, by: number) {
  const box = (await page.getByRole('separator', { name }).boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + by, y, { steps: 4 })
  await page.mouse.up()
}

test('dragging a pane edge resizes it, and the width is still there after a reload', async ({ page }) => {
  await openFirstSong(page)
  expect(await widthOf(page, '.library')).toBe(240)

  await drag(page, 'Resize song list', 80)
  expect(await widthOf(page, '.library')).toBe(320)

  const previewBefore = await widthOf(page, '.preview')
  await drag(page, 'Resize PDF preview', 60)
  expect(await widthOf(page, '.preview')).toBe(previewBefore - 60)

  await page.reload()
  expect(await widthOf(page, '.library')).toBe(320)
  expect(await widthOf(page, '.preview')).toBe(previewBefore - 60)
})

test('arrow keys move a pane edge and a double-click puts it back', async ({ page }) => {
  await openFirstSong(page)
  const handle = page.getByRole('separator', { name: 'Resize song list' })
  await handle.focus()
  await page.keyboard.press('ArrowRight')
  expect(await widthOf(page, '.library')).toBe(256)
  await handle.dblclick()
  expect(await widthOf(page, '.library')).toBe(240)
})

test('the chord inspector can be dragged wider', async ({ page }) => {
  await openFirstSong(page)
  await page.getByRole('button', { name: /^Chord / }).first().click()
  expect(await widthOf(page, '.inspector')).toBe(280)
  await drag(page, 'Resize chord inspector', -50)
  expect(await widthOf(page, '.inspector')).toBe(330)
})
