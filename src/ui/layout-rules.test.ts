import { describe, expect, it } from 'vitest'
import { previewVisible } from './layout-rules'

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
