import type { PdfFonts } from '../domain/pdf-render'

let cached: Promise<PdfFonts> | null = null

export function loadPdfFonts(): Promise<PdfFonts> {
  cached ??= (async () => {
    const load = async (path: string) => new Uint8Array(await (await fetch(path)).arrayBuffer())
    return {
      sans: await load('/fonts/Inter-Regular.ttf'),
      sansBold: await load('/fonts/Inter-Bold.ttf'),
      sansItalic: await load('/fonts/Inter-Italic.ttf'),
      mono: await load('/fonts/JetBrainsMono-Regular.ttf'),
      monoBold: await load('/fonts/JetBrainsMono-ExtraBold.ttf'),
    }
  })()
  return cached
}
