import { describe, expect, it } from 'vitest'
import { fitPanes, previewVisible } from './layout-rules'

describe('previewVisible on laptop', () => {
  it('closes the preview while the inspector is open, and brings it back after', () => {
    expect(previewVisible({ phone: false, inspectorOpen: false })).toBe(true)
    expect(previewVisible({ phone: false, inspectorOpen: true })).toBe(false)
  })

  it('leaves phones alone (their preview is its own screen)', () => {
    expect(previewVisible({ phone: true, inspectorOpen: true })).toBe(true)
  })
})

describe('Show PDF preview while editing a chord', () => {
  it('brings the preview back beside the inspector when asked', () => {
    expect(previewVisible({ phone: false, inspectorOpen: true, peek: true })).toBe(true)
  })
})

describe('fitPanes', () => {
  const laptop = { viewport: 1440, inspectorOpen: false }

  it('leaves widths that fit as they are, and an unset preview sharing the space', () => {
    expect(fitPanes({ library: 300, inspector: 320, preview: 500 }, laptop)).toEqual({ library: 300, inspector: 320, preview: 500 })
    expect(fitPanes({ library: 240, inspector: 280, preview: null }, laptop).preview).toBeNull()
  })

  it('keeps the library and the inspector between their narrowest and widest', () => {
    expect(fitPanes({ library: 20, inspector: 5000, preview: null }, laptop)).toEqual({ library: 180, inspector: 420, preview: null })
    expect(fitPanes({ library: 900, inspector: 10, preview: null }, laptop)).toEqual({ library: 400, inspector: 240, preview: null })
  })

  it('stops the preview before the chart gets narrower than 400px', () => {
    // 1440 - 240 library - 400 chart = 800
    expect(fitPanes({ library: 240, inspector: 280, preview: 1200 }, laptop).preview).toBe(800)
    // the open inspector takes its 280 from the same space
    expect(fitPanes({ library: 240, inspector: 280, preview: 1200 }, { viewport: 1440, inspectorOpen: true }).preview).toBe(520)
  })

  it('never makes the preview narrower than 320px', () => {
    expect(fitPanes({ library: 240, inspector: 280, preview: 40 }, laptop).preview).toBe(320)
    expect(fitPanes({ library: 400, inspector: 420, preview: 600 }, { viewport: 1200, inspectorOpen: true }).preview).toBe(320)
  })
})
