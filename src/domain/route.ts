import type { Invite } from './band'

/**
 * Where the app is, as the part of the address after `#`.
 * A song or setlist id resolves on every device of the band that holds it. An invite carries what joining needs.
 */
export type Route =
  | { place: 'songs' }
  | { place: 'song'; id: string }
  | { place: 'setlists' }
  | { place: 'setlist'; id: string }
  | { place: 'settings' }
  | { place: 'import' }
  | { place: 'join'; invite: Invite }

export function formatRoute(route: Route): string {
  if (route.place === 'song' || route.place === 'setlist') return `#/${route.place}/${encodeURIComponent(route.id)}`
  if (route.place === 'join') {
    const { bandId, joinCode, name } = route.invite
    return `#/join/${[bandId, joinCode, name].map(encodeURIComponent).join('/')}`
  }
  return `#/${route.place}`
}

/** The whole invite link, for copying or sharing. */
export function inviteLink(invite: Invite, base = `${location.origin}${location.pathname}`): string {
  return `${base}${formatRoute({ place: 'join', invite })}`
}

/** Reads `location.hash`. Null when it is empty, a share link, or not an address this app writes. */
export function parseRoute(hash: string): Route | null {
  const [, place, ...parts] = hash.replace(/^#/, '').split('/')
  let decoded: string[]
  try {
    decoded = parts.map(decodeURIComponent)
  } catch {
    return null
  }
  if (place === 'join') {
    const [bandId, joinCode, name = '', ...extra] = decoded
    if (!bandId || !joinCode || extra.length > 0) return null
    return { place, invite: { bandId, joinCode, name } }
  }
  if (place === 'song' || place === 'setlist') {
    if (decoded.length !== 1 || !decoded[0]) return null
    return { place, id: decoded[0] }
  }
  if (parts.length > 0) return null
  if (place === 'songs' || place === 'setlists' || place === 'settings' || place === 'import') return { place }
  return null
}
