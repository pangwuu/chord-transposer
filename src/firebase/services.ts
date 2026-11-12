import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import type { BandSession } from '../domain/band'
import { firestoreBands } from './band-session'
import { firebaseTarget } from './config'
import { AUTH_EMULATOR, FIRESTORE_EMULATOR } from './emulator'

/**
 * The band session the real app runs on. The persistent multi-tab cache keeps the library in this browser,
 * so later launches open from it, edits work offline, and the SDK sends them when the connection returns.
 */
export function firebaseBands(env: ImportMetaEnv): BandSession {
  const target = firebaseTarget(env)
  const app = initializeApp(target.options)
  const auth = getAuth(app)
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    ignoreUndefinedProperties: true,
  })
  if (target.emulator) {
    connectAuthEmulator(auth, AUTH_EMULATOR, { disableWarnings: true })
    connectFirestoreEmulator(
      db,
      FIRESTORE_EMULATOR.host,
      FIRESTORE_EMULATOR.port,
    )
  }
  return firestoreBands({ auth, db, storage: localStorage })
}
