/**
 * Lays an incoming library snapshot over a list already on screen: the shown order holds,
 * every item is the incoming copy, removed items go, and newcomers join at one end.
 */
export function followOrder<T extends { id: string }>(shown: T[], incoming: T[], newcomers: 'first' | 'last'): T[] {
  const byId = new Map(incoming.map((item) => [item.id, item]))
  const kept = shown.flatMap((item) => byId.get(item.id) ?? [])
  const known = new Set(shown.map((item) => item.id))
  const fresh = incoming.filter((item) => !known.has(item.id))
  return newcomers === 'first' ? [...fresh, ...kept] : [...kept, ...fresh]
}
