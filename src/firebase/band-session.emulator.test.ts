import { afterAll, describe, expect, it, vi } from 'vitest'
import { amazingGrace, firstLight } from '../fixtures/charts'
import {
  InviteRefused,
  NEW_BAND_NAME,
  type ActiveBand,
  type BandInfo,
} from '../domain/band'
import type { LibrarySnapshot } from '../domain/library-types'
import { emulatorClient } from './emulator-client'
import { firestoreBands } from './band-session'
import { firestoreLibrary } from './firestore-library'

const closing: Array<() => Promise<void> | void> = []
afterAll(async () => {
  for (const close of closing.reverse()) await close()
})

function memoryStorage(): Storage {
  const held = new Map<string, string>()
  return {
    get length() {
      return held.size
    },
    clear: () => held.clear(),
    getItem: (key) => held.get(key) ?? null,
    key: (index) => [...held.keys()][index] ?? null,
    removeItem: (key) => void held.delete(key),
    setItem: (key, value) => void held.set(key, value),
  }
}

/** One browser: its own sign-in, cache and storage. */
function browser() {
  const client = emulatorClient()
  closing.push(client.close)
  const storage = memoryStorage()
  const session = () =>
    firestoreBands({ auth: client.auth, db: client.db, storage })
  return { session, db: client.db }
}

function opened(band: ActiveBand) {
  closing.push(() => band.close())
  return band
}

async function contents(band: ActiveBand): Promise<LibrarySnapshot> {
  return new Promise((resolve) => {
    const stop = band.library.subscribe((snapshot) => {
      stop()
      resolve(snapshot)
    })
  })
}

async function info(
  band: ActiveBand,
  until: (info: BandInfo) => boolean = () => true,
): Promise<BandInfo> {
  return new Promise((resolve) => {
    const stop = band.watch((value) => {
      if (!until(value)) return
      stop()
      resolve(value)
    })
  })
}

describe('band session', () => {
  it('has no band in a new browser', async () => {
    expect(await browser().session().resume()).toBeNull()
  })

  it('creates “My library” with this browser as its only member, seeded with the demo songs', async () => {
    const band = opened(await browser().session().create())
    expect(await info(band)).toMatchObject({ name: NEW_BAND_NAME, members: 1 })
    expect(
      (await contents(band)).songs.map((song) => song.title).sort(),
    ).toEqual([amazingGrace.title, firstLight.title].sort())
  })

  it('finds the same band on the next start in the same browser, and does not seed it again', async () => {
    const laptop = browser()
    const band = opened(await laptop.session().create())
    await band.library.deleteSong(amazingGrace.id)
    await vi.waitFor(async () =>
      expect((await contents(band)).songs.map((song) => song.id)).toEqual([
        firstLight.id,
      ]),
    )
    band.close()
    const again = opened((await laptop.session().resume())!)
    expect(again.id).toBe(band.id)
    expect((await contents(again)).songs.map((song) => song.id)).toEqual([
      firstLight.id,
    ])
  })

  it('joins a band from its invite link, and both members see each other’s edits', async () => {
    const leader = opened(await browser().session().create())
    await leader.library.deleteSong(amazingGrace.id)
    const { invite } = await info(leader)
    const member = opened(await browser().session().join(invite))
    expect(member.id).toBe(leader.id)
    expect((await contents(member)).songs.map((song) => song.id)).toEqual([
      firstLight.id,
    ])
    await info(leader, (value) => value.members === 2)
    const seen: string[] = []
    const stop = leader.library.subscribe((snapshot) =>
      seen.push(...snapshot.songs.map((song) => song.title)),
    )
    await member.library.saveSong({
      ...firstLight,
      title: 'First Light (band key)',
    })
    await vi.waitFor(() => expect(seen).toContain('First Light (band key)'), {
      timeout: 5000,
    })
    stop()
  })

  it('opens the joined band on the next start', async () => {
    const leader = opened(await browser().session().create())
    const phone = browser()
    const joined = opened(
      await phone.session().join((await info(leader)).invite),
    )
    joined.close()
    expect((await phone.session().resume())?.id).toBe(leader.id)
  })

  it('refuses a wrong join code, and keeps the band already open', async () => {
    const leader = opened(await browser().session().create())
    const phone = browser()
    const own = opened(await phone.session().create())
    const { invite } = await info(leader)
    await expect(
      phone.session().join({ ...invite, joinCode: 'wrong-code-0123456789xyz' }),
    ).rejects.toBeInstanceOf(InviteRefused)
    await expect(
      phone.session().join({ ...invite, bandId: 'no-such-band' }),
    ).rejects.toBeInstanceOf(InviteRefused)
    expect((await phone.session().resume())?.id).toBe(own.id)
  })

  it('leaves a band: the old band can no longer be read, and a fresh seeded “My library” opens', async () => {
    const leader = opened(await browser().session().create())
    const phone = browser()
    const joined = await phone.session().join((await info(leader)).invite)
    await info(leader, (value) => value.members === 2)
    const fresh = opened(await phone.session().leave(joined))
    expect(fresh.id).not.toBe(leader.id)
    expect(await info(fresh)).toMatchObject({ name: NEW_BAND_NAME, members: 1 })
    expect((await contents(fresh)).songs).toHaveLength(2)
    await info(leader, (value) => value.members === 1)
    const old = firestoreLibrary(phone.db, leader.id)
    closing.push(() => old.close())
    await new Promise((resolve) => old.subscribe(() => {}, resolve))
    expect((await phone.session().resume())?.id).toBe(fresh.id)
  })
})
