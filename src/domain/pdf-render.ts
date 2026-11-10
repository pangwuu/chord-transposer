import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import {
  blockHeight,
  columnBounds,
  type PdfBlock,
  type PdfDocument,
  type PdfPage,
} from './pdf-layout'

export type PdfFonts = {
  sans: Uint8Array
  sansBold: Uint8Array
  sansItalic: Uint8Array
  mono: Uint8Array
  monoBold: Uint8Array
}

export async function renderPdf(
  layout: PdfDocument,
  fonts: PdfFonts,
): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const sans = await document.embedFont(fonts.sans)
  const sansBold = await document.embedFont(fonts.sansBold)
  const sansItalic = await document.embedFont(fonts.sansItalic)
  const mono = await document.embedFont(fonts.mono)
  const monoBold = await document.embedFont(fonts.monoBold)
  for (const layoutPage of layout.pages) {
    const page = document.addPage([layoutPage.width, layoutPage.height])
    drawPage(
      page,
      layoutPage,
      {
        fontSize: layout.fontSize,
        spacing: layout.spacing,
        chordLyricSpacing: layout.chordLyricSpacing,
        sectionLeadIn: layout.sectionLeadIn,
        showColumnDivider: layout.showColumnDivider,
        showSectionDivider: layout.showSectionDivider,
      },
      {
        sans,
        sansBold,
        sansItalic,
        mono,
        monoBold,
      },
    )
  }
  return document.save()
}

export async function rightHandParts(
  parts: Uint8Array[],
): Promise<Uint8Array[]> {
  const padded: Uint8Array[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const doc = await PDFDocument.load(parts[index])
    if (index < parts.length - 1 && doc.getPageCount() % 2 === 1) {
      const size = doc.getPage(0).getSize()
      doc.addPage([size.width, size.height])
    }
    padded.push(await doc.save())
  }
  return padded
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

type DrawStyle = {
  fontSize: number
  spacing: number
  chordLyricSpacing: number
  sectionLeadIn: number
  showColumnDivider: boolean
  showSectionDivider: boolean
}

type DrawFonts = {
  sans: PDFFont
  sansBold: PDFFont
  sansItalic: PDFFont
  mono: PDFFont
  monoBold: PDFFont
}

function drawPage(
  page: PDFPage,
  layout: PdfPage,
  style: DrawStyle,
  fonts: DrawFonts,
) {
  const ink = rgb(0, 0, 0)
  const secondary = rgb(0.2, 0.2, 0.2)
  const hair = rgb(0.6, 0.6, 0.6)
  const left = 42
  const right = layout.width - 42
  let y = layout.height - 42
  if (!layout.runningHeader) {
    page.drawText(layout.title, {
      x: left,
      y: y - 18,
      size: 21,
      font: fonts.sansBold,
      color: ink,
    })
    y -= 24
    if (layout.artist) {
      page.drawText(layout.artist, {
        x: left,
        y: y - 10,
        size: 10.5,
        font: fonts.sans,
        color: secondary,
      })
      y -= 16
    }
    if (layout.meta || layout.capoLabel) {
      if (layout.meta)
        page.drawText(layout.meta, {
          x: left,
          y: y - 10,
          size: 10,
          font: fonts.sans,
          color: ink,
        })
      if (layout.capoLabel)
        page.drawText(layout.capoLabel, {
          x: left + 220,
          y: y - 10,
          size: 9,
          font: fonts.sansBold,
          color: ink,
        })
      y -= 18
    }
    if (layout.order) {
      page.drawText(layout.order, {
        x: left,
        y: y - 9,
        size: 9,
        font: fonts.sans,
        color: secondary,
      })
      y -= 14
    }
  } else {
    page.drawText(layout.runningHeader, {
      x: left,
      y: y - 10,
      size: 9.5,
      font: fonts.sansBold,
      color: ink,
    })
    if (layout.meta)
      page.drawText(layout.meta, {
        x: right - fonts.sans.widthOfTextAtSize(layout.meta, 9.5),
        y: y - 10,
        size: 9.5,
        font: fonts.sans,
        color: ink,
      })
    y -= 16
  }
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: layout.runningHeader ? 0.75 : 1,
    color: ink,
  })
  y -= 16
  const twoColumn = layout.columnCount === 2
  if (!twoColumn) {
    for (const block of layout.blocks)
      y = drawBlock(page, block, y, left, right, style, fonts, ink, secondary, hair)
  } else {
    const [first, second] = columnBounds(layout.width, 2)
    let leftY = y
    let rightY = y
    for (const block of layout.blocks) {
      if (block.column === 2)
        rightY = drawBlock(
          page,
          block,
          rightY,
          second.left,
          second.right,
          style,
          fonts,
          ink,
          secondary,
          hair,
        )
      else
        leftY = drawBlock(
          page,
          block,
          leftY,
          first.left,
          first.right,
          style,
          fonts,
          ink,
          secondary,
          hair,
        )
    }
    if (style.showColumnDivider) {
      const ruleX = (first.right + second.left) / 2
      page.drawLine({
        start: { x: ruleX, y },
        end: { x: ruleX, y: Math.min(leftY, rightY) },
        thickness: 0.5,
        color: hair,
      })
    }
  }
  page.drawText(layout.footerTitle, {
    x: left,
    y: 28,
    size: 8.5,
    font: fonts.sans,
    color: secondary,
  })
  page.drawText(layout.cue, {
    x: left,
    y: 16,
    size: 9,
    font: fonts.sansItalic,
    color: secondary,
  })
  const labelWidth = fonts.sansBold.widthOfTextAtSize(layout.pageLabel, 9.5)
  page.drawText(layout.pageLabel, {
    x: right - labelWidth,
    y: 22,
    size: 9.5,
    font: fonts.sansBold,
    color: ink,
  })
}

function drawBlock(
  page: PDFPage,
  block: PdfBlock,
  y: number,
  left: number,
  right: number,
  style: DrawStyle,
  fonts: DrawFonts,
  ink: ReturnType<typeof rgb>,
  secondary: ReturnType<typeof rgb>,
  hair: ReturnType<typeof rgb>,
): number {
  const { fontSize, spacing } = style
  const height = blockHeight(block, fontSize, spacing, {
    chordLyricSpacing: style.chordLyricSpacing,
    sectionLeadIn: style.sectionLeadIn,
  })
  if (block.kind === 'section') {
    const lead = style.sectionLeadIn * spacing
    page.drawText(block.label, {
      x: left,
      y: y - lead - 11,
      size: 11,
      font: fonts.sansBold,
      color: ink,
    })
    if (style.showSectionDivider) {
      const textWidth = fonts.sansBold.widthOfTextAtSize(block.label, 11)
      page.drawLine({
        start: { x: left + textWidth + 8, y: y - lead - 8 },
        end: { x: right, y: y - lead - 8 },
        thickness: 0.6,
        color: hair,
      })
    }
    return y - height
  }
  if (block.kind === 'comment' || block.kind === 'pointer') {
    page.drawText(block.text, {
      x: left,
      y: y - Math.min(10, height - 1),
      size: 9.5,
      font: fonts.sansItalic,
      color: secondary,
    })
    return y - height
  }
  if (block.kind === 'bars') {
    page.drawText(block.text, {
      x: left,
      y: y - fontSize,
      size: fontSize,
      font: fonts.monoBold,
      color: ink,
    })
    return y - height
  }
  const advance = fontSize * 0.6
  if (block.chords.length > 0) {
    for (const chord of block.chords) {
      page.drawText(chord.label, {
        x: left + chord.index * advance,
        y: y - fontSize,
        size: fontSize,
        font: fonts.monoBold,
        color: ink,
      })
    }
    page.drawText(block.text, {
      x: left,
      y: y - height + fontSize * 0.2,
      size: fontSize,
      font: fonts.mono,
      color: ink,
    })
    return y - height
  }
  page.drawText(block.text, {
    x: left,
    y: y - fontSize,
    size: fontSize,
    font: fonts.mono,
    color: ink,
  })
  return y - height
}
