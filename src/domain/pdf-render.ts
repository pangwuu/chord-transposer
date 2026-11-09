import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { PdfBlock, PdfDocument, PdfPage } from './pdf-layout'

export type PdfFonts = {
  sans: Uint8Array
  sansBold: Uint8Array
  sansItalic: Uint8Array
  mono: Uint8Array
  monoBold: Uint8Array
}

export async function renderPdf(layout: PdfDocument, fonts: PdfFonts): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const sans = await document.embedFont(fonts.sans)
  const sansBold = await document.embedFont(fonts.sansBold)
  const sansItalic = await document.embedFont(fonts.sansItalic)
  const mono = await document.embedFont(fonts.mono)
  const monoBold = await document.embedFont(fonts.monoBold)
  for (const layoutPage of layout.pages) {
    const page = document.addPage([layoutPage.width, layoutPage.height])
    drawPage(page, layoutPage, layout.fontSize, { sans, sansBold, sansItalic, mono, monoBold })
  }
  return document.save()
}

export async function mergePdfs(parts: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const part of parts) {
    const doc = await PDFDocument.load(part)
    const copied = await out.copyPages(doc, doc.getPageIndices())
    copied.forEach((page) => out.addPage(page))
  }
  return out.save()
}

function drawPage(page: PDFPage, layout: PdfPage, fontSize: number, fonts: { sans: PDFFont; sansBold: PDFFont; sansItalic: PDFFont; mono: PDFFont; monoBold: PDFFont }) {
  const ink = rgb(0, 0, 0)
  const secondary = rgb(0.2, 0.2, 0.2)
  const hair = rgb(0.6, 0.6, 0.6)
  const left = 42
  const right = layout.width - 42
  let y = layout.height - 42
  if (!layout.runningHeader) {
    page.drawText(layout.title, { x: left, y: y - 18, size: 21, font: fonts.sansBold, color: ink })
    y -= 24
    if (layout.artist) {
      page.drawText(layout.artist, { x: left, y: y - 10, size: 10.5, font: fonts.sans, color: secondary })
      y -= 16
    }
    page.drawText(layout.meta, { x: left, y: y - 10, size: 10, font: fonts.sans, color: ink })
    if (layout.capoLabel) page.drawText(layout.capoLabel, { x: left + 220, y: y - 10, size: 9, font: fonts.sansBold, color: ink })
    y -= 18
    if (layout.order) {
      page.drawText(layout.order, { x: left, y: y - 9, size: 9, font: fonts.sans, color: secondary })
      y -= 14
    }
  } else {
    page.drawText(layout.runningHeader, { x: left, y: y - 10, size: 9.5, font: fonts.sansBold, color: ink })
    page.drawText(layout.meta, { x: right - fonts.sans.widthOfTextAtSize(layout.meta, 9.5), y: y - 10, size: 9.5, font: fonts.sans, color: ink })
    y -= 16
  }
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: layout.runningHeader ? 0.75 : 1, color: ink })
  y -= 16
  for (const block of layout.blocks) y = drawBlock(page, block, y, left, right, fontSize, fonts, ink, secondary, hair)
  page.drawText(layout.footerTitle, { x: left, y: 28, size: 8.5, font: fonts.sans, color: secondary })
  page.drawText(layout.cue, { x: left, y: 16, size: 9, font: fonts.sansItalic, color: secondary })
  const labelWidth = fonts.sansBold.widthOfTextAtSize(layout.pageLabel, 9.5)
  page.drawText(layout.pageLabel, { x: right - labelWidth, y: 22, size: 9.5, font: fonts.sansBold, color: ink })
}

function drawBlock(
  page: PDFPage,
  block: PdfBlock,
  y: number,
  left: number,
  right: number,
  fontSize: number,
  fonts: { sans: PDFFont; sansBold: PDFFont; sansItalic: PDFFont; mono: PDFFont; monoBold: PDFFont },
  ink: ReturnType<typeof rgb>,
  secondary: ReturnType<typeof rgb>,
  hair: ReturnType<typeof rgb>,
): number {
  if (block.kind === 'section') {
    page.drawText(block.label, { x: left, y: y - 11, size: 11, font: fonts.sansBold, color: ink })
    const textWidth = fonts.sansBold.widthOfTextAtSize(block.label, 11)
    page.drawLine({ start: { x: left + textWidth + 8, y: y - 8 }, end: { x: right, y: y - 8 }, thickness: 0.6, color: hair })
    return y - 30
  }
  if (block.kind === 'comment' || block.kind === 'pointer') {
    page.drawText(block.text, { x: left, y: y - 10, size: 9.5, font: fonts.sansItalic, color: secondary })
    return y - 16
  }
  if (block.kind === 'bars') {
    page.drawText(block.text, { x: left, y: y - fontSize, size: fontSize, font: fonts.mono, color: ink })
    return y - Math.ceil(fontSize * 1.7)
  }
  const advance = fontSize * 0.6
  if (block.chords.length > 0) {
    for (const chord of block.chords) {
      page.drawText(chord.label, { x: left + chord.index * advance, y: y - fontSize, size: fontSize, font: fonts.monoBold, color: ink })
    }
    y -= Math.ceil(fontSize * 1.15)
  }
  page.drawText(block.text, { x: left, y: y - fontSize, size: fontSize, font: fonts.mono, color: ink })
  return y - Math.ceil(block.chords.length > 0 ? fontSize * 1.05 : fontSize * 1.35)
}
