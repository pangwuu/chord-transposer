import { amazingGrace, firstLight } from '../fixtures/charts'
import {
  InviteRefused,
  NEW_BAND_NAME,
  NeedsConnection,
  newJoinCode,
  type ActiveBand,
  type BandInfo,
  type BandSession,
} from './band'
import type { LibrarySnapshot } from './library-types'
import { memoryLibrary } from './memory-library'

const KEY = 'csm-test-band'

type Held = {
  id: string
  name: string
  joinCode: string
  snapshot: LibrarySnapshot
}

const offline = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false

/**
 * Bands without a backend, for test mode: one band of one, held in `storage`.
 * It needs a connection where the real one does, so offline behaviour can be tested without Firebase.
 */
export function memoryBands(storage: Storage): BandSession {
  const read = (): Held | null => {
    try {
      return JSON.parse(storage.getItem(KEY) ?? 'null')
    } catch {
      return null
    }
  }
  const write = (held: Held) => storage.setItem(KEY, JSON.stringify(held))

  function open(held: Held): ActiveBand {
    let current = held
    const library = memoryLibrary(held.snapshot)
    library.subscribe((snapshot) => {
      current = { ...current, snapshot }
      write(current)
    })
    const watchers = new Set<(info: BandInfo) => void>()
    const info = (): BandInfo => ({
      id: current.id,
      name: current.name,
      members: 1,
      invite: {
        bandId: current.id,
        joinCode: current.joinCode,
        name: current.name,
      },
    })
    return {
      id: held.id,
      library,
      watch(onChange) {
        watchers.add(onChange)
        queueMicrotask(() => watchers.has(onChange) && onChange(info()))
        return () => void watchers.delete(onChange)
      },
      async rename(name) {
        current = { ...current, name }
        write(current)
        for (const watcher of [...watchers]) watcher(info())
      },
      close: () => watchers.clear(),
    }
  }

  function create(): Promise<ActiveBand> {
    if (offline()) return Promise.reject(new NeedsConnection())
    const held: Held = {
      id: crypto.randomUUID(),
      name: NEW_BAND_NAME,
      joinCode: newJoinCode(),
      snapshot: { songs: [amazingGrace, firstLight], setlists: [] },
    }
    write(held)
    return Promise.resolve(open(held))
  }

  return {
    async resume() {
      const held = read()
      return held ? open(held) : null
    },
    create,
    async join(invite) {
      if (offline()) throw new NeedsConnection()
      const held = read()
      if (
        !held ||
        held.id !== invite.bandId ||
        held.joinCode !== invite.joinCode
      )
        throw new InviteRefused()
      return open(held)
    },
    async leave(band) {
      if (offline()) throw new NeedsConnection()
      band.close()
      return create()
    },
  }
}
