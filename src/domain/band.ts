import type { LibraryRepository } from './library-types'

/** What an invite link carries. `name` is only a label for the confirmation; the band's own name may have changed since. */
export type Invite = { bandId: string; joinCode: string; name: string }

export type BandInfo = {
  id: string
  name: string
  members: number
  invite: Invite
}

/** The band this browser has open. */
export type ActiveBand = {
  id: string
  library: LibraryRepository
  /** Delivers the band's name and member count now, and again whenever either changes. Returns the unsubscribe. */
  watch(onChange: (info: BandInfo) => void): () => void
  rename(name: string): Promise<void>
  /** Stops listening. The band and this browser's membership are untouched. */
  close(): void
}

/** Membership: which band this browser has open, and moving between bands. One band at a time. */
export type BandSession = {
  /** This browser's band, from what it already has, or null when it has none yet. Needs no connection. */
  resume(): Promise<ActiveBand | null>
  /** Creates “My library”, with this browser as its only member, seeded with the demo songs. */
  create(): Promise<ActiveBand>
  /** Joins the band in an invite link and opens it. The band open before stays as it was. */
  join(invite: Invite): Promise<ActiveBand>
  /** Gives up membership of `band`, then creates a fresh “My library”. */
  leave(band: ActiveBand): Promise<ActiveBand>
}

export const NEW_BAND_NAME = 'My library'

/** Thrown when a step needs the server and there is no connection. */
export class NeedsConnection extends Error {
  constructor() {
    super('This needs an internet connection')
    this.name = 'NeedsConnection'
  }
}

/** Thrown when an invite link's band does not exist or its join code is not the band's current one. */
export class InviteRefused extends Error {
  constructor() {
    super('That invite link did not work')
    this.name = 'InviteRefused'
  }
}

/** An unguessable join code: 144 random bits as 24 URL-safe characters. */
export function newJoinCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}
