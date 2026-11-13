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

/**
 * Deep equality for plain data, ignoring key order and treating an undefined field as missing.
 * A copy that comes back from the server has both differences without being a different song.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => sameValue(item, b[index]))
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const keys = (value: object) => Object.entries(value).filter(([, item]) => item !== undefined).map(([key]) => key)
  const left = keys(a)
  const right = keys(b)
  const other = b as Record<string, unknown>
  return left.length === right.length && left.every((key) => key in other && sameValue((a as Record<string, unknown>)[key], other[key]))
}
