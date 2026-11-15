import type { PaneWidths } from '../domain/library-types'

/**
 * Laptop shows the PDF preview or the chord inspector beside the editor, not both, so the chart keeps its width.
 * "Show PDF preview" (peek) brings it back beside the inspector until the chord is deselected.
 */
export function previewVisible({ phone, inspectorOpen, peek = false }: { phone: boolean; inspectorOpen: boolean; peek?: boolean }): boolean {
  return phone || !inspectorOpen || peek
}

const LIBRARY = { min: 180, max: 400 }
const INSPECTOR = { min: 240, max: 420 }
const PREVIEW_MIN = 320
const CHART_MIN = 400

/**
 * The widths the desktop panes get, from the widths the user asked for.
 * The library and inspector stay within their own limits; the preview gives way so the chart keeps 400px, but never drops below 320px.
 */
export function fitPanes(wanted: PaneWidths, { viewport, inspectorOpen }: { viewport: number; inspectorOpen: boolean }): PaneWidths {
  const within = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, value)))
  const library = within(wanted.library, LIBRARY.min, LIBRARY.max)
  const inspector = within(wanted.inspector, INSPECTOR.min, INSPECTOR.max)
  const room = viewport - library - CHART_MIN - (inspectorOpen ? inspector : 0)
  const preview = wanted.preview === null ? null : within(wanted.preview, PREVIEW_MIN, Math.max(PREVIEW_MIN, room))
  return { library, inspector, preview }
}
