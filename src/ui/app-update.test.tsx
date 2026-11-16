import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyUpdateWhenSafe } from './app-update'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('taking an app update', () => {
  it('applies straight away when nothing is unsaved and nobody is typing', async () => {
    const apply = vi.fn()
    applyUpdateWhenSafe(apply, { isUnsaved: () => false })
    await Promise.resolve()
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('waits while an edit is unsaved, then applies once', () => {
    vi.useFakeTimers()
    const apply = vi.fn()
    let unsaved = true
    applyUpdateWhenSafe(apply, { isUnsaved: () => unsaved, every: 1000 })
    vi.advanceTimersByTime(5000)
    expect(apply).not.toHaveBeenCalled()
    unsaved = false
    vi.advanceTimersByTime(3000)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('waits while someone is typing in a field', () => {
    vi.useFakeTimers()
    const apply = vi.fn()
    const field = document.createElement('input')
    document.body.append(field)
    field.focus()
    applyUpdateWhenSafe(apply, { isUnsaved: () => false, every: 1000 })
    vi.advanceTimersByTime(4000)
    expect(apply).not.toHaveBeenCalled()
    field.blur()
    vi.advanceTimersByTime(1000)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('stops waiting when told to', () => {
    vi.useFakeTimers()
    const apply = vi.fn()
    const stop = applyUpdateWhenSafe(apply, { isUnsaved: () => true, every: 1000 })
    stop()
    vi.advanceTimersByTime(5000)
    expect(apply).not.toHaveBeenCalled()
  })
})
