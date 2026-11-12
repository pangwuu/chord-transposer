import { signInAnonymously, type Auth } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import {
  InviteRefused,
  NEW_BAND_NAME,
  NeedsConnection,
  newJoinCode,
  type ActiveBand,
  type BandSession,
  type Invite,
} from '../domain/band'
import { amazingGrace, firstLight } from '../fixtures/charts'
import { firestoreLibrary } from './firestore-library'

/** Which band this browser has open, for which signed-in user. Lost with the sign-in when the browser's storage is wiped. */
const POINTER_KEY = 'csm-band'

type Pointer = { uid: string; bandId: string }

const offline = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false

function codeOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : ''
}

/** Bands in Cloud Firestore, joined through Firebase Anonymous Authentication. */
export function firestoreBands({
  auth,
  db,
  storage,
}: {
  auth: Auth
  db: Firestore
  storage: Storage
}): BandSession {
  const readPointer = (): Pointer | null => {
    try {
      const value = JSON.parse(storage.getItem(POINTER_KEY) ?? 'null')
      return value &&
        typeof value.uid === 'string' &&
        typeof value.bandId === 'string'
        ? value
        : null
    } catch {
      return null
    }
  }
  const writePointer = (pointer: Pointer | null) => {
    try {
      if (pointer) storage.setItem(POINTER_KEY, JSON.stringify(pointer))
      else storage.removeItem(POINTER_KEY)
    } catch {
      // Blocked storage: the band lasts for this visit only.
    }
  }

  async function signedIn(): Promise<string> {
    await auth.authStateReady()
    if (auth.currentUser) return auth.currentUser.uid
    if (offline()) throw new NeedsConnection()
    try {
      return (await signInAnonymously(auth)).user.uid
    } catch (error) {
      if (codeOf(error) === 'auth/network-request-failed')
        throw new NeedsConnection()
      throw error
    }
  }

  function open(uid: string, bandId: string): ActiveBand {
    writePointer({ uid, bandId })
    const library = firestoreLibrary(db, bandId)
    const stops = new Set<() => void>()
    return {
      id: bandId,
      library,
      watch(onChange) {
        let band: { name: string; joinCode: string } | null = null
        let members: number | null = null
        const deliver = () => {
          if (!band || members === null) return
          onChange({
            id: bandId,
            name: band.name,
            members,
            invite: { bandId, joinCode: band.joinCode, name: band.name },
          })
        }
        const quiet = () => {}
        const one = onSnapshot(
          doc(db, 'bands', bandId),
          (shot) => {
            const data = shot.data()
            if (!data) return
            band = { name: String(data.name), joinCode: String(data.joinCode) }
            deliver()
          },
          quiet,
        )
        const two = onSnapshot(
          collection(db, 'bands', bandId, 'members'),
          (shot) => {
            members = shot.size
            deliver()
          },
          quiet,
        )
        const stop = () => {
          one()
          two()
          stops.delete(stop)
        }
        stops.add(stop)
        return stop
      },
      async rename(name) {
        void updateDoc(doc(db, 'bands', bandId), { name }).catch((error) =>
          console.error('The band was not renamed', error),
        )
      },
      close() {
        for (const stop of [...stops]) stop()
        library.close()
      },
    }
  }

  async function create(): Promise<ActiveBand> {
    const uid = await signedIn()
    if (offline()) throw new NeedsConnection()
    const band = doc(collection(db, 'bands'))
    const joinCode = newJoinCode()
    const batch = writeBatch(db)
    batch.set(band, {
      name: NEW_BAND_NAME,
      owner: uid,
      joinCode,
      createdAt: Date.now(),
    })
    batch.set(doc(band, 'members', uid), { joinCode, joinedAt: Date.now() })
    for (const song of [amazingGrace, firstLight])
      batch.set(doc(band, 'songs', song.id), song)
    await batch.commit()
    return open(uid, band.id)
  }

  return {
    async resume() {
      await auth.authStateReady()
      const uid = auth.currentUser?.uid
      const pointer = readPointer()
      if (!uid || !pointer || pointer.uid !== uid) return null
      return open(uid, pointer.bandId)
    },

    create,

    async join(invite: Invite) {
      const uid = await signedIn()
      if (offline()) throw new NeedsConnection()
      const member = doc(db, 'bands', invite.bandId, 'members', uid)
      // Reading your own member document works only once you are a member: then there is nothing to write.
      const already = await getDoc(member).then(
        (shot) => shot.exists(),
        () => false,
      )
      if (!already) {
        try {
          await setDoc(member, {
            joinCode: invite.joinCode,
            joinedAt: Date.now(),
          })
        } catch (error) {
          if (codeOf(error) === 'permission-denied') throw new InviteRefused()
          throw error
        }
      }
      return open(uid, invite.bandId)
    },

    async leave(band) {
      const uid = await signedIn()
      if (offline()) throw new NeedsConnection()
      band.close()
      await deleteDoc(doc(db, 'bands', band.id, 'members', uid))
      writePointer(null)
      return create()
    },
  }
}
