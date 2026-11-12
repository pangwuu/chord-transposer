import { describe, expect, it } from 'vitest'
import { formatRoute, parseRoute, type Route } from './route'

describe('routes in the address bar', () => {
  it('gives every screen, song and setlist its own address', () => {
    expect(formatRoute({ place: 'songs' })).toBe('#/songs')
    expect(formatRoute({ place: 'song', id: 'abc-123' })).toBe('#/song/abc-123')
    expect(formatRoute({ place: 'setlists' })).toBe('#/setlists')
    expect(formatRoute({ place: 'setlist', id: 'set 1' })).toBe('#/setlist/set%201')
    expect(formatRoute({ place: 'settings' })).toBe('#/settings')
    expect(formatRoute({ place: 'import' })).toBe('#/import')
  })

  it('reads back every address it writes', () => {
    const routes: Route[] = [
      { place: 'songs' },
      { place: 'song', id: 'abc-123' },
      { place: 'setlists' },
      { place: 'setlist', id: 'set 1/2' },
      { place: 'settings' },
      { place: 'import' },
    ]
    for (const route of routes) expect(parseRoute(formatRoute(route))).toEqual(route)
  })

  it('reads nothing from an empty address, a share link, or an unknown one', () => {
    expect(parseRoute('')).toBeNull()
    expect(parseRoute('#')).toBeNull()
    expect(parseRoute('#1.H4sIAAAA')).toBeNull()
    expect(parseRoute('#/song')).toBeNull()
    expect(parseRoute('#/song/')).toBeNull()
    expect(parseRoute('#/nowhere')).toBeNull()
    expect(parseRoute('#/song/%E0%A4%A')).toBeNull()
  })
})
