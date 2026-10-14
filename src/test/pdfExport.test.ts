import { PDFDocument } from 'pdf-lib'
import { beforeAll, describe, expect, it } from 'vitest'
import { getDocument } from '@/lib/pdfjs'
import { buildAnnotatedPdfBytes } from '@/utils/pdfExport'
import type { AnnotationRootState } from '@/utils/annotationRootReducer'

let samplePdfBytes: Uint8Array

beforeAll(async () => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  page.drawText('Sample', { x: 72, y: 700, size: 24 })
  samplePdfBytes = new Uint8Array(await doc.save())
})

describe('pdfExport', () => {
  it('exports annotations when pdf.js uses a separate worker buffer', async () => {
    const storedBytes = new Uint8Array(samplePdfBytes)
    await getDocument({ data: storedBytes.slice() }).promise

    const state: AnnotationRootState = {
      pages: {
        1: {
          annotations: [
            {
              id: 'rect-1',
              type: 'rectangle',
              x: 72,
              y: 72,
              width: 120,
              height: 80,
              stroke: '#1d4ed8',
              strokeWidth: 2,
              rotation: 0,
            },
          ],
          selectedId: null,
        },
      },
      pageDimensions: {
        1: { width: 612, height: 792 },
      },
    }

    const exported = await buildAnnotatedPdfBytes(storedBytes, state)
    expect(exported.byteLength).toBeGreaterThan(0)

    const reopened = await PDFDocument.load(exported)
    expect(reopened.getPageCount()).toBe(1)
  })
})
