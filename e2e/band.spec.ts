import { expect, type Page, test } from '@playwright/test'
import { openFirstSong } from './helpers'

function phone(page: Page) {
  return (page.viewportSize()?.width ?? 1280) < 768
}

/** Opens the app and waits until its library is showing. */
async function openApp(page: Page) {
  await openFirstSong(page)
  await expect(page.getByLabel('Title')).toHaveValue('Amazing Grace')
}

async function openSettings(page: Page) {
  await page
    .getByRole('button', { name: 'Settings', exact: true })
    .filter({ visible: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

/** The library's song list. A phone shows it on its own screen. */
async function songList(page: Page) {
  if (phone(page))
    await page
      .getByRole('button', { name: 'Songs', exact: true })
      .filter({ visible: true })
      .click()
  return page
    .getByRole('button', { name: /Amazing Grace|First Light/ })
    .filter({ visible: true })
}

test('a band of one sees its link as the recovery link in Settings', async ({
  page,
}) => {
  await openApp(page)
  await openSettings(page)
  const band = page.getByRole('region', { name: 'Band' })
  await expect(band.getByLabel('Band name')).toHaveValue('My library')
  await expect(band).toContainText('Recovery link')
  await expect(band).toContainText('Only you are in this library')
})

test('renaming the band keeps the new name after a reload', async ({
  page,
}) => {
  await openApp(page)
  await openSettings(page)
  const name = page.getByLabel('Band name')
  await name.fill('Sunday team')
  await name.press('Enter')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByLabel('Band name')).toHaveValue('Sunday team')
})

test('a new library asks once to save its recovery link', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('csm-recovery-prompted'))
      sessionStorage.setItem('csm-test-show-recovery', '1')
  })
  await page.goto('/')
  const prompt = page.getByRole('dialog', { name: 'Save your recovery link' })
  await expect(prompt).toBeVisible()
  await expect(
    prompt.getByRole('button', { name: 'Copy recovery link' }),
  ).toBeVisible()
  await prompt.getByRole('button', { name: 'Done' }).click()
  await expect(prompt).toBeHidden()
  await page.reload()
  await expect(
    page.getByRole('button', { name: /Amazing Grace/ }).first(),
  ).toBeVisible()
  await expect(prompt).toBeHidden()
})

test('the last member is warned before leaving, and cancelling keeps the library', async ({
  page,
}) => {
  await openApp(page)
  await openSettings(page)
  await page.getByRole('button', { name: 'Leave…' }).click()
  const dialog = page.getByRole('dialog', {
    name: 'Leave My library for good?',
  })
  await expect(dialog).toContainText("You're its only member")
  await expect(
    dialog.getByRole('button', { name: 'Download backup' }),
  ).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Copy recovery link' }),
  ).toBeVisible()
  const leave = dialog.getByRole('button', { name: 'Leave and lose access' })
  await expect(leave).toBeDisabled()
  await dialog.getByLabel('Library name to confirm').fill('My librar')
  await expect(leave).toBeDisabled()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(await songList(page)).toHaveCount(2)
})

test('leaving as the last member, once the name is typed, opens a fresh library', async ({
  page,
}) => {
  await openApp(page)
  await openSettings(page)
  await page.getByLabel('Band name').fill('Old band')
  await page.getByLabel('Band name').press('Enter')
  await page.getByRole('button', { name: 'Leave…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Leave Old band for good?' })
  await dialog.getByLabel('Library name to confirm').fill('Old band')
  await dialog.getByRole('button', { name: 'Leave and lose access' }).click()
  await expect(dialog).toBeHidden()
  await openSettings(page)
  await expect(page.getByLabel('Band name')).toHaveValue('My library')
})

test('an invite link that does not work leaves the library as it was', async ({
  page,
}) => {
  await openApp(page)
  await page.evaluate(() => {
    location.hash = '#/join/no-such-band/not-the-code-0123456789/Other%20band'
  })
  const dialog = page.getByRole('dialog', { name: 'Join Other band?' })
  await expect(dialog).toContainText("You're the only member of “My library”")
  await dialog.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByRole('status')).toContainText(
    "That invite link didn't work",
  )
  await expect(page.getByRole('status')).toContainText(
    'Your library is unchanged',
  )
  await expect(await songList(page)).toHaveCount(2)
})

test('cancelling an invite leaves the library as it was', async ({ page }) => {
  await openApp(page)
  await page.evaluate(() => {
    location.hash = '#/join/no-such-band/not-the-code-0123456789/Other%20band'
  })
  await page
    .getByRole('dialog', { name: 'Join Other band?' })
    .getByRole('button', { name: 'Cancel' })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(await songList(page)).toHaveCount(2)
})

test('the invite link for the open band says so instead of asking', async ({
  page,
}) => {
  await openApp(page)
  const link = await page.evaluate(() => {
    const held = JSON.parse(sessionStorage.getItem('csm-test-band') ?? 'null')
    return `#/join/${held.id}/${held.joinCode}/My%20library`
  })
  await page.evaluate((hash) => {
    location.hash = hash
  }, link)
  await expect(page.getByRole('status')).toContainText(
    "You're already in My library",
  )
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('an invite opened offline explains that joining needs a connection', async ({
  page,
  context,
}) => {
  await openApp(page)
  await context.setOffline(true)
  await page.evaluate(() => {
    location.hash = '#/join/some-band/some-code-0123456789abcd/Other%20band'
  })
  await page
    .getByRole('dialog', { name: 'Join Other band?' })
    .getByRole('button', { name: 'Join' })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Joining a band needs an internet connection',
  )
  await expect(page.getByRole('status')).toContainText(
    'Your library is unchanged',
  )
  await context.setOffline(false)
})

test('a first launch with no connection says so, and finishes setting up once connected', async ({
  page,
  context,
}) => {
  // The browser is offline from the start. The app's own files still arrive, as an installed app's would from its cache.
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\//, async (route) =>
    route.fulfill({ response: await route.fetch() }),
  )
  await context.setOffline(true)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Connect to the internet to set up' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Amazing Grace/ })).toHaveCount(
    0,
  )
  await context.setOffline(false)
  // Back online, the network serves the app again. A fetch still in flight must not outlive the test.
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await expect(
    page.getByRole('heading', { name: 'Connect to the internet to set up' }),
  ).toBeHidden()
  await expect(
    page.getByRole('button', { name: /Amazing Grace/ }).first(),
  ).toBeVisible()
})
