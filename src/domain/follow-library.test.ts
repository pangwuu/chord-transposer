import { describe, expect, it } from 'vitest'
import { followOrder, sameValue } from './follow-library'

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

describe('sameValue', () => {
  it('ignores key order and missing-versus-undefined, as a copy back from the server differs', () => {
    expect(sameValue({ a: 1, b: { c: [1, { d: 2 }] }, e: undefined }, { b: { c: [1, { d: 2 }] }, a: 1 })).toBe(true)
  })

  it('notices any changed value, array order or length', () => {
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false)
    expect(sameValue({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
    expect(sameValue({ a: [1] }, { a: [1, 1] })).toBe(false)
    expect(sameValue({ a: null }, { a: {} })).toBe(false)
  })
})
