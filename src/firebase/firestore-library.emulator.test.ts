import { doc, setDoc } from 'firebase/firestore'
import { afterAll } from 'vitest'
import { libraryContract } from '../domain/library-contract'
import { signedInClient } from './emulator-client'
import { firestoreLibrary } from './firestore-library'

const closing: Array<() => Promise<void>> = []
afterAll(async () => {
  for (const close of closing) await close()
})

/** A band of one, made the way a member would make it, holding nothing yet. */
async function emptyBand() {
  const client = await signedInClient()
  closing.push(client.close)
  const bandId = crypto.randomUUID()
  const joinCode = 'test-join-code-0123456789abc'
  await setDoc(doc(client.db, 'bands', bandId), {
    name: 'Test band',
    owner: client.uid,
    joinCode,
    createdAt: 1,
  })
  await setDoc(doc(client.db, 'bands', bandId, 'members', client.uid), {
    joinCode,
    joinedAt: 1,
  })
  const library = firestoreLibrary(client.db, bandId)
  closing.unshift(async () => library.close())
  return library
}

libraryContract('Firestore', emptyBand)
