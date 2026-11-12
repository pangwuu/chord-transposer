/** Laptop shows the PDF preview or the chord inspector beside the editor, never both, so the chart keeps its width. */
export function previewVisible({ phone, inspectorOpen }: { phone: boolean; inspectorOpen: boolean }): boolean {
  return phone || !inspectorOpen
}
