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

  it('gives an invite link its own address, carrying the band, its join code and its name', () => {
    const invite = { bandId: 'AbC123', joinCode: 'q-W_e9rTy0uIoPa8sDfGh7jK', name: 'Sunday team / AM' }
    const address = formatRoute({ place: 'join', invite })
    expect(address).toBe('#/join/AbC123/q-W_e9rTy0uIoPa8sDfGh7jK/Sunday%20team%20%2F%20AM')
    expect(parseRoute(address)).toEqual({ place: 'join', invite })
  })

  it('reads no invite from an address missing its band or code', () => {
    expect(parseRoute('#/join')).toBeNull()
    expect(parseRoute('#/join/AbC123')).toBeNull()
    expect(parseRoute('#/join/AbC123//Band')).toBeNull()
    expect(parseRoute('#/join/AbC123/code/Band/extra')).toBeNull()
  })

  it('reads an invite whose name was cut off', () => {
    expect(parseRoute('#/join/AbC123/code')).toEqual({ place: 'join', invite: { bandId: 'AbC123', joinCode: 'code', name: '' } })
  })
})
