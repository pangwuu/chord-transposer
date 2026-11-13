import { expect, type Browser, type Page, test } from '@playwright/test'

/** A browser of its own: a separate sign-in, cache and storage, as a bandmate's phone would have. */
async function newBrowser(browser: Browser) {
  const context = await browser.newContext()
  return context.newPage()
}

/** First launch: a library is made, and the recovery prompt is put away. */
async function startLibrary(page: Page) {
  await page.goto('/')
  await page
    .getByRole('dialog', { name: 'Save your recovery link' })
    .getByRole('button', { name: 'Done' })
    .click()
  await expect(page.getByLabel('Title')).toHaveValue('Amazing Grace')
}

async function bandLink(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page
    .getByRole('region', { name: 'Band' })
    .getByRole('button', { name: 'Copy link' })
    .click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toMatch(/#\/join\//)
  return link
}

async function joinFrom(page: Page, link: string, name: string) {
  await page.goto(link)
  await page
    .getByRole('dialog', { name: `Join ${name}?` })
    .getByRole('button', { name: 'Join' })
    .click()
}

test('two members of a band see each other’s edits without reloading', async ({
  browser,
}) => {
  const leader = await newBrowser(browser)
  await startLibrary(leader)
  const link = await bandLink(leader)

  const member = await newBrowser(browser)
  await joinFrom(member, link, 'My library')
  await expect(
    member.getByRole('button', { name: /First Light/ }),
  ).toBeVisible()
  await expect(leader.getByRole('region', { name: 'Band' })).toContainText(
    '2 members share this library',
  )
  await expect(leader.getByRole('region', { name: 'Band' })).toContainText(
    'Invite link',
  )

  await member.getByRole('button', { name: /First Light/ }).click()
  await member.getByLabel('Title').fill('First Light (in D)')
  await member.getByLabel('Title').press('Enter')
  await expect(
    leader.getByRole('button', { name: /First Light \(in D\)/ }),
  ).toBeVisible({ timeout: 15_000 })
})

test('a recovery link opens the same library in a fresh browser', async ({
  browser,
}) => {
  const laptop = await newBrowser(browser)
  await startLibrary(laptop)
  await laptop.getByRole('button', { name: '+ New song' }).click()
  await laptop.getByLabel('Title').fill('Only on the laptop')
  await laptop.getByLabel('Title').press('Enter')
  await expect(laptop.getByText('Saved')).toBeVisible()
  const link = await bandLink(laptop)

  const wiped = await newBrowser(browser)
  await joinFrom(wiped, link, 'My library')
  await expect(
    wiped.getByRole('button', { name: /Only on the laptop/ }),
  ).toBeVisible()
})

test('an edit made offline reaches the band once the connection returns', async ({
  browser,
}) => {
  const leader = await newBrowser(browser)
  await startLibrary(leader)
  const link = await bandLink(leader)
  const member = await newBrowser(browser)
  await joinFrom(member, link, 'My library')
  await expect(
    member.getByRole('button', { name: /Amazing Grace/ }),
  ).toBeVisible()

  await member.context().setOffline(true)
  await member.getByRole('button', { name: /Amazing Grace/ }).click()
  await member.getByLabel('Title').fill('Amazing Grace (offline edit)')
  await member.getByLabel('Title').press('Enter')
  await expect(
    member.getByRole('button', { name: /offline edit/ }),
  ).toBeVisible()
  await leader.waitForTimeout(1500)
  await expect(
    leader.getByRole('button', { name: /offline edit/ }),
  ).toHaveCount(0)

  await member.context().setOffline(false)
  await expect(
    leader.getByRole('button', { name: /offline edit/ }),
  ).toBeVisible({ timeout: 20_000 })
})
