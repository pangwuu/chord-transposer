/**
 * Laptop shows the PDF preview or the chord inspector beside the editor, not both, so the chart keeps its width.
 * "Show PDF preview" (peek) brings it back beside the inspector until the chord is deselected.
 */
export function previewVisible({ phone, inspectorOpen, peek = false }: { phone: boolean; inspectorOpen: boolean; peek?: boolean }): boolean {
  return phone || !inspectorOpen || peek
}
