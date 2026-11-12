import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type Auth,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  terminate,
  type Firestore,
} from 'firebase/firestore'
import { AUTH_EMULATOR, EMULATOR_PROJECT, FIRESTORE_EMULATOR } from './emulator'

let count = 0

/** A browser of its own against the emulators: its own app, auth and cache, as a separate device would have. */
export function emulatorClient(): {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  close: () => Promise<void>
} {
  const app = initializeApp(
    { projectId: EMULATOR_PROJECT, apiKey: 'emulator' },
    `client-${++count}`,
  )
  const auth = getAuth(app)
  connectAuthEmulator(auth, AUTH_EMULATOR, { disableWarnings: true })
  const db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    ignoreUndefinedProperties: true,
  })
  connectFirestoreEmulator(db, FIRESTORE_EMULATOR.host, FIRESTORE_EMULATOR.port)
  return {
    app,
    auth,
    db,
    async close() {
      await terminate(db)
      await deleteApp(app)
    },
  }
}

export async function signedInClient() {
  const client = emulatorClient()
  const { user } = await signInAnonymously(client.auth)
  return { ...client, uid: user.uid }
}
