import { describe, expect, it } from 'vitest'
import { followOrder } from './follow-library'

const item = (id: string, name = id) => ({ id, name })

describe('following a library snapshot on screen', () => {
  it('keeps the order already shown and takes the incoming copies', () => {
    const shown = [item('b'), item('a')]
    expect(followOrder(shown, [item('a', 'A2'), item('b', 'B2')], 'first')).toEqual([item('b', 'B2'), item('a', 'A2')])
  })

  it('drops what the library no longer holds', () => {
    expect(followOrder([item('a'), item('b')], [item('b')], 'first')).toEqual([item('b')])
  })

  it('puts newcomers first or last, as asked', () => {
    expect(followOrder([item('a')], [item('a'), item('n')], 'first').map((it) => it.id)).toEqual(['n', 'a'])
    expect(followOrder([item('a')], [item('a'), item('n')], 'last').map((it) => it.id)).toEqual(['a', 'n'])
  })
})
