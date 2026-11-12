import { readFileSync } from 'node:fs'
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AUTH_EMULATOR, EMULATOR_PROJECT, FIRESTORE_EMULATOR } from './emulator'

// Placeholder: proves the emulators are up and reachable from Vitest. Real band tests replace it.
describe('Firebase emulators', () => {
  let rules: RulesTestEnvironment
  let app: FirebaseApp

  beforeAll(async () => {
    rules = await initializeTestEnvironment({
      projectId: EMULATOR_PROJECT,
      firestore: { ...FIRESTORE_EMULATOR, rules: readFileSync('firestore.rules', 'utf8') },
    })
    app = initializeApp({ projectId: EMULATOR_PROJECT, apiKey: 'emulator' })
  })

  afterAll(async () => {
    await rules.cleanup()
    await deleteApp(app)
  })

  it('signs a browser in anonymously', async () => {
    const auth = getAuth(app)
    connectAuthEmulator(auth, AUTH_EMULATOR, { disableWarnings: true })
    const { user } = await signInAnonymously(auth)
    expect(user.isAnonymous).toBe(true)
    expect(user.uid).not.toBe('')
  })

  it('stores a document and reads it back', async () => {
    await rules.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'wiring/check'), { ok: true })
    })
    await rules.withSecurityRulesDisabled(async (context) => {
      expect((await getDoc(doc(context.firestore(), 'wiring/check'))).data()).toEqual({ ok: true })
    })
  })

  it('applies firestore.rules, which are closed for now', async () => {
    const stranger = rules.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(stranger, 'wiring/check')))
  })
})
