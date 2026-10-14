import {
  PDFDocument,
  StandardFonts,
  type PDFPage,
  type RGB,
  rgb,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
} from 'pdf-lib'
import type { Annotation } from '@/types/annotation'
import type { AnnotationRootState } from '@/utils/annotationRootReducer'
import { textBlockSize } from '@/utils/annotationGeometry'
import { normalizeHexColor } from '@/utils/annotationStyle'
import {
  annotationRotation,
  getAnnotationPivot,
} from '@/utils/annotationTransform'
import { downloadBlob } from '@/utils/annotationPersistence'

type PageScale = {
  scaleX: number
  scaleY: number
}

export async function buildAnnotatedPdfBytes(
  pdfBytes: Uint8Array,
  state: AnnotationRootState,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes.slice(), {
    ignoreEncryption: true,
  })
  const pages = pdfDoc.getPages()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)

  for (const [pageIndexKey, slice] of Object.entries(state.pages)) {
    const pageIndex = Number(pageIndexKey)
    if (slice.annotations.length === 0) {
      continue
    }
    const page = pages[pageIndex - 1]
    if (!page) {
      continue
    }

    const { width, height } = page.getSize()
    const storedDimensions =
      state.pageDimensions[pageIndex] ?? { width, height }
    const scale: PageScale = {
      scaleX: width / storedDimensions.width,
      scaleY: height / storedDimensions.height,
    }

    for (const annotation of slice.annotations) {
      drawAnnotationOnPage(page, height, scale, annotation, {
        regular: fontRegular,
        bold: fontBold,
        italic: fontItalic,
        boldItalic: fontBoldItalic,
      })
    }
  }

  return pdfDoc.save()
}

export function downloadAnnotatedPdf(
  pdfBytes: Uint8Array,
  state: AnnotationRootState,
  fileName: string,
): Promise<void> {
  return buildAnnotatedPdfBytes(pdfBytes, state).then((bytes) => {
    const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })
    downloadBlob(blob, annotatedPdfFileName(fileName))
  })
}

export function annotatedPdfFileName(sourceName: string): string {
  const stamp = Date.now()
  const trimmed = sourceName.trim() || 'document.pdf'
  const base = trimmed.toLowerCase().endsWith('.pdf')
    ? trimmed.slice(0, -4)
    : trimmed
  return `${base}-annotated-${stamp}.pdf`
}

type TextFonts = {
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>
  italic: Awaited<ReturnType<PDFDocument['embedFont']>>
  boldItalic: Awaited<ReturnType<PDFDocument['embedFont']>>
}

function drawAnnotationOnPage(
  page: PDFPage,
  pageHeight: number,
  scale: PageScale,
  annotation: Annotation,
  fonts: TextFonts,
) {
  const pivot = getAnnotationPivot(annotation)
  const pivotX = pivot.x * scale.scaleX
  const pivotYTop = pivot.y * scale.scaleY
  const rotation = annotationRotation(annotation)

  withRotation(page, pageHeight, pivotX, pivotYTop, rotation, () => {
    switch (annotation.type) {
      case 'rectangle':
        page.drawRectangle({
          x: annotation.x * scale.scaleX,
          y: toPdfY(
            annotation.y + annotation.height,
            pageHeight,
            scale.scaleY,
          ),
          width: annotation.width * scale.scaleX,
          height: annotation.height * scale.scaleY,
          borderColor: hexToRgb(annotation.stroke),
          borderWidth: annotation.strokeWidth * ((scale.scaleX + scale.scaleY) / 2),
        })
        return
      case 'circle': {
        const radius =
          annotation.radius * ((scale.scaleX + scale.scaleY) / 2)
        const cx = annotation.cx * scale.scaleX
        const cyTop = annotation.cy * scale.scaleY
        page.drawEllipse({
          x: cx,
          y: pageHeight - cyTop,
          xScale: radius,
          yScale: radius,
          borderColor: hexToRgb(annotation.stroke),
          borderWidth: annotation.strokeWidth * ((scale.scaleX + scale.scaleY) / 2),
        })
        return
      }
      case 'line':
        page.drawLine({
          start: {
            x: annotation.start.x * scale.scaleX,
            y: pageHeight - annotation.start.y * scale.scaleY,
          },
          end: {
            x: annotation.end.x * scale.scaleX,
            y: pageHeight - annotation.end.y * scale.scaleY,
          },
          color: hexToRgb(annotation.stroke),
          thickness:
            annotation.strokeWidth * ((scale.scaleX + scale.scaleY) / 2),
        })
        return
      case 'text':
        drawTextAnnotation(page, pageHeight, scale, annotation, fonts)
        return
      default: {
        const unreachable: never = annotation
        return unreachable
      }
    }
  })
}

function drawTextAnnotation(
  page: PDFPage,
  pageHeight: number,
  scale: PageScale,
  annotation: Extract<Annotation, { type: 'text' }>,
  fonts: TextFonts,
) {
  const fontSize = annotation.fontSize * scale.scaleY
  const font = pickTextFont(fonts, annotation.bold, annotation.italic)
  const lines = annotation.text.split('\n')
  const x = annotation.x * scale.scaleX
  let yTop = annotation.y * scale.scaleY

  for (const line of lines) {
    const baselineY = pageHeight - yTop - fontSize * 0.85
    page.drawText(sanitizePdfText(line), {
      x,
      y: baselineY,
      size: fontSize,
      font,
      color: hexToRgb(annotation.color),
    })
    yTop += annotation.fontSize * scale.scaleY
  }

  if (annotation.underline && lines.length > 0) {
    const block = textBlockSize(annotation.text, annotation.fontSize)
    const underlineY =
      pageHeight - (annotation.y + block.height) * scale.scaleY
    page.drawLine({
      start: { x, y: underlineY },
      end: {
        x: x + block.width * scale.scaleX,
        y: underlineY,
      },
      color: hexToRgb(annotation.color),
      thickness: Math.max(1, fontSize * 0.06),
    })
  }
}

function pickTextFont(fonts: TextFonts, bold: boolean, italic: boolean) {
  if (bold && italic) {
    return fonts.boldItalic
  }
  if (bold) {
    return fonts.bold
  }
  if (italic) {
    return fonts.italic
  }
  return fonts.regular
}

function withRotation(
  page: PDFPage,
  pageHeight: number,
  pivotX: number,
  pivotYTop: number,
  rotationCw: number,
  draw: () => void,
) {
  if (rotationCw === 0) {
    draw()
    return
  }

  const pivotPdfX = pivotX
  const pivotPdfY = pageHeight - pivotYTop
  const theta = (-rotationCw * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)

  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(
      cos,
      sin,
      -sin,
      cos,
      pivotPdfX - cos * pivotPdfX + sin * pivotPdfY,
      pivotPdfY - sin * pivotPdfX - cos * pivotPdfY,
    ),
  )
  draw()
  page.pushOperators(popGraphicsState())
}

function toPdfY(yTop: number, pageHeight: number, scaleY: number): number {
  return pageHeight - yTop * scaleY
}

/** Standard PDF fonts only support WinAnsi; strip unsupported characters. */
function sanitizePdfText(text: string): string {
  return text.replace(/[^\t\n\r\x20-\xFF]/g, '?')
}

function hexToRgb(hex: string): RGB {
  const normalized = normalizeHexColor(hex) ?? '#000000'
  const value = normalized.slice(1)
  const r = Number.parseInt(value.slice(0, 2), 16) / 255
  const g = Number.parseInt(value.slice(2, 4), 16) / 255
  const b = Number.parseInt(value.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}
