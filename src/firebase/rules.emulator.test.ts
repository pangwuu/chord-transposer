import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { EMULATOR_PROJECT, FIRESTORE_EMULATOR } from './emulator'

const CODE = 'right-join-code-0123456789'
let env: RulesTestEnvironment
let band: string

const as = (uid: string) => env.authenticatedContext(uid).firestore()
const stranger = () => env.unauthenticatedContext().firestore()

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT,
    firestore: {
      ...FIRESTORE_EMULATOR,
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })
})
afterAll(() => env.cleanup())

/** Each test gets a band owned by `alice`, holding one song. */
beforeEach(async () => {
  band = crypto.randomUUID()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'bands', band), {
      name: 'Alice band',
      owner: 'alice',
      joinCode: CODE,
      createdAt: 1,
    })
    await setDoc(doc(db, 'bands', band, 'members', 'alice'), {
      joinCode: CODE,
      joinedAt: 1,
    })
    await setDoc(doc(db, 'bands', band, 'songs', 'song-1'), {
      id: 'song-1',
      title: 'Hymn',
    })
  })
})

describe('a member', () => {
  it('reads and writes the band’s songs and setlists', async () => {
    await assertSucceeds(
      getDoc(doc(as('alice'), 'bands', band, 'songs', 'song-1')),
    )
    await assertSucceeds(
      setDoc(doc(as('alice'), 'bands', band, 'songs', 'song-2'), {
        id: 'song-2',
      }),
    )
    await assertSucceeds(
      setDoc(doc(as('alice'), 'bands', band, 'setlists', 'set-1'), {
        id: 'set-1',
      }),
    )
    await assertSucceeds(
      deleteDoc(doc(as('alice'), 'bands', band, 'songs', 'song-1')),
    )
  })

  it('renames the band, and changes nothing else about it', async () => {
    await assertSucceeds(
      updateDoc(doc(as('alice'), 'bands', band), { name: 'Sunday team' }),
    )
    await assertFails(
      updateDoc(doc(as('alice'), 'bands', band), {
        joinCode: 'another-code-0123456789',
      }),
    )
    await assertFails(updateDoc(doc(as('alice'), 'bands', band), { name: '' }))
  })

  it('leaves, and cannot remove anyone else', async () => {
    await assertSucceeds(
      setDoc(doc(as('bob'), 'bands', band, 'members', 'bob'), {
        joinCode: CODE,
        joinedAt: 2,
      }),
    )
    await assertFails(
      deleteDoc(doc(as('alice'), 'bands', band, 'members', 'bob')),
    )
    await assertSucceeds(
      deleteDoc(doc(as('bob'), 'bands', band, 'members', 'bob')),
    )
    await assertFails(getDoc(doc(as('bob'), 'bands', band, 'songs', 'song-1')))
  })
})

describe('someone who is not a member', () => {
  it('cannot read or write the band’s songs', async () => {
    await assertFails(
      getDoc(doc(as('mallory'), 'bands', band, 'songs', 'song-1')),
    )
    await assertFails(
      setDoc(doc(as('mallory'), 'bands', band, 'songs', 'song-2'), {
        id: 'song-2',
      }),
    )
    await assertFails(getDoc(doc(stranger(), 'bands', band, 'songs', 'song-1')))
  })

  it('cannot read the band, so never sees its join code', async () => {
    await assertFails(getDoc(doc(as('mallory'), 'bands', band)))
    await assertFails(
      getDoc(doc(as('mallory'), 'bands', band, 'members', 'alice')),
    )
  })

  it('cannot join with a wrong code, and can with the right one', async () => {
    await assertFails(
      setDoc(doc(as('bob'), 'bands', band, 'members', 'bob'), {
        joinCode: 'wrong-code-0123456789xyz',
        joinedAt: 2,
      }),
    )
    await assertFails(
      setDoc(doc(as('bob'), 'bands', band, 'members', 'mallory'), {
        joinCode: CODE,
        joinedAt: 2,
      }),
    )
    await assertSucceeds(
      setDoc(doc(as('bob'), 'bands', band, 'members', 'bob'), {
        joinCode: CODE,
        joinedAt: 2,
      }),
    )
    await assertSucceeds(
      getDoc(doc(as('bob'), 'bands', band, 'songs', 'song-1')),
    )
  })

  it('as a member of band A, cannot touch band B', async () => {
    const other = crypto.randomUUID()
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'bands', other), {
        name: 'B',
        owner: 'carol',
        joinCode: 'b-code-0123456789abcdef',
        createdAt: 1,
      })
    })
    await assertFails(getDoc(doc(as('alice'), 'bands', other)))
    await assertFails(
      setDoc(doc(as('alice'), 'bands', other, 'songs', 'x'), { id: 'x' }),
    )
  })
})

describe('creating a band', () => {
  it('works for a signed-in user as its owner, with themselves as first member and songs in one batch', async () => {
    const id = crypto.randomUUID()
    const db = as('dave')
    const batch = writeBatch(db)
    batch.set(doc(db, 'bands', id), {
      name: 'My library',
      owner: 'dave',
      joinCode: CODE,
      createdAt: 1,
    })
    batch.set(doc(db, 'bands', id, 'members', 'dave'), {
      joinCode: CODE,
      joinedAt: 1,
    })
    batch.set(doc(db, 'bands', id, 'songs', 'song-1'), { id: 'song-1' })
    await assertSucceeds(batch.commit())
  })

  it('refuses another owner, a short join code, or no sign-in', async () => {
    await assertFails(
      setDoc(doc(as('dave'), 'bands', crypto.randomUUID()), {
        name: 'X',
        owner: 'erin',
        joinCode: CODE,
        createdAt: 1,
      }),
    )
    await assertFails(
      setDoc(doc(as('dave'), 'bands', crypto.randomUUID()), {
        name: 'X',
        owner: 'dave',
        joinCode: 'short',
        createdAt: 1,
      }),
    )
    await assertFails(
      setDoc(doc(stranger(), 'bands', crypto.randomUUID()), {
        name: 'X',
        owner: 'dave',
        joinCode: CODE,
        createdAt: 1,
      }),
    )
  })

  it('cannot overwrite a band that exists', async () => {
    await assertFails(
      setDoc(doc(as('mallory'), 'bands', band), {
        name: 'Mine',
        owner: 'mallory',
        joinCode: 'mallory-code-0123456789',
        createdAt: 2,
      }),
    )
    await assertFails(
      setDoc(doc(as('alice'), 'bands', band), {
        name: 'Mine',
        owner: 'alice',
        joinCode: 'new-code-0123456789abc',
        createdAt: 2,
      }),
    )
  })
})
