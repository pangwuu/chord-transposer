import { expect, test } from '@playwright/test'

test('keeps the last lyric above the next-page footer on a full preview page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Use ChordPro Editor', exact: true }).click()
  const lines = Array.from({ length: 50 }, (_, i) =>
    i % 2 === 0
      ? '[F]Why can\'t they understand the way we [C]feel?'
      : '[F]They just don\'t trust what they can\'t [C]explain',
  ).join('\n')
  await page.getByLabel('ChordPro source').fill(
    `{title: Untitled song}\n{artist: Phil}\n{key: C}\n{start_of_verse}\n${lines}\n{end_of_verse}\n`,
  )
  await expect(page.getByLabel('Title')).toHaveValue('Untitled song')
  await expect(page.getByLabel('Artist')).toHaveValue('Phil')
  const paper = page.locator('.preview .paper').first()
  await expect(paper.locator('.paper-foot')).toContainText('Next page')
  expect(await page.locator('.preview .paper').count()).toBeGreaterThan(1)

  const overlap = await paper.evaluate((root) => {
    const foot = root.querySelector('.paper-foot')
    if (!foot) return { error: 'missing foot' as const }
    const footBox = foot.getBoundingClientRect()
    let lowest: { text: string; top: number; bottom: number } | null = null
    const hits: { text: string; top: number; bottom: number }[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const text = node.textContent?.trim() ?? ''
      if (!text) continue
      const parent = node.parentElement
      if (!parent || foot.contains(parent)) continue
      const box = parent.getBoundingClientRect()
      if (box.height === 0) continue
      const item = { text: text.slice(0, 60), top: box.top, bottom: box.bottom }
      if (box.bottom > footBox.top && box.top < footBox.bottom) hits.push(item)
      if (!lowest || box.bottom > lowest.bottom) lowest = item
    }
    return {
      footTop: footBox.top,
      footBottom: footBox.bottom,
      lowest,
      gap: lowest ? footBox.top - lowest.bottom : null,
      hits,
    }
  })

  expect(overlap, JSON.stringify(overlap)).toMatchObject({ hits: [] })
  expect(overlap.gap, JSON.stringify(overlap)).toBeGreaterThanOrEqual(0)
})
