import { describe, expect, it } from 'vitest'
import { parseKey } from './chord'
import { fromChordPro } from './chordpro'
import { findSongs, idSequence } from './song'

const ids = idSequence('find')

function song(title: string, artist: string, lyric: string) {
  return { ...fromChordPro(`{title: ${title}}\n{artist: ${artist}}\n{key: G}\n[G]${lyric}`, ids), originalKey: parseKey('G') }
}

const titles = (songs: { title: string }[]) => songs.map((item) => item.title)

describe('finding songs', () => {
  const grace = song('Amazing Grace', 'John Newton', 'How sweet the sound')
  const light = song('First Light', 'Dear John', 'Morning on the kitchen table')
  const abide = song('Abide With Me', 'Henry Lyte', 'Fast falls the eventide, the sound of evening')

  it('lists every song A to Z when there is no query', () => {
    expect(titles(findSongs([light, grace, abide], ''))).toEqual(['Abide With Me', 'Amazing Grace', 'First Light'])
  })

  it('finds a song by a line of its lyrics', () => {
    expect(titles(findSongs([grace, light, abide], 'kitchen'))).toEqual(['First Light'])
  })

  it('finds a song by its artist', () => {
    expect(titles(findSongs([grace, light, abide], 'newton'))).toEqual(['Amazing Grace'])
  })

  it('matches every word, wherever each one is', () => {
    expect(titles(findSongs([grace, light, abide], 'john morning'))).toEqual(['First Light'])
  })

  it('puts title matches ahead of lyric matches', () => {
    const sound = song('The Sound', 'Someone', 'La la la')
    expect(titles(findSongs([grace, abide, sound], 'sound'))).toEqual(['The Sound', 'Abide With Me', 'Amazing Grace'])
  })
})
