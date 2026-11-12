/** Where the app is, as the part of the address after `#`. A song or setlist id only means something on a device that holds it. */
export type Route =
  | { place: 'songs' }
  | { place: 'song'; id: string }
  | { place: 'setlists' }
  | { place: 'setlist'; id: string }
  | { place: 'settings' }
  | { place: 'import' }

export function formatRoute(route: Route): string {
  if (route.place === 'song' || route.place === 'setlist') return `#/${route.place}/${encodeURIComponent(route.id)}`
  return `#/${route.place}`
}

/** Reads `location.hash`. Null when it is empty, a share link, or not an address this app writes. */
export function parseRoute(hash: string): Route | null {
  const [, place, rest, ...extra] = hash.replace(/^#/, '').split('/')
  if (extra.length > 0) return null
  if (place === 'song' || place === 'setlist') {
    if (!rest) return null
    try {
      return { place, id: decodeURIComponent(rest) }
    } catch {
      return null
    }
  }
  if (rest !== undefined) return null
  if (place === 'songs' || place === 'setlists' || place === 'settings' || place === 'import') return { place }
  return null
}
