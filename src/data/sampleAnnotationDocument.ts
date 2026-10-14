import type { AnnotationDocument } from '@/types/persistence'
import { ANNOTATION_DOCUMENT_VERSION } from '@/types/persistence'

/** Example import file: one of each annotation type on a letter-sized page. */
export const SAMPLE_ANNOTATION_DOCUMENT: AnnotationDocument = {
  version: ANNOTATION_DOCUMENT_VERSION,
  page: { width: 612, height: 792 },
  annotations: [
    {
      id: 'sample-rectangle',
      type: 'rectangle',
      x: 48,
      y: 72,
      width: 200,
      height: 100,
      stroke: '#1d4ed8',
      strokeWidth: 2,
      rotation: 0,
    },
    {
      id: 'sample-circle',
      type: 'circle',
      cx: 420,
      cy: 160,
      radius: 56,
      stroke: '#16a34a',
      strokeWidth: 2,
      rotation: 0,
    },
    {
      id: 'sample-line',
      type: 'line',
      start: { x: 72, y: 280 },
      end: { x: 320, y: 340 },
      stroke: '#dc2626',
      strokeWidth: 3,
      rotation: 0,
    },
    {
      id: 'sample-text',
      type: 'text',
      x: 48,
      y: 400,
      text: 'Sample text annotation\nImport this file via Import JSON.',
      fontSize: 18,
      color: '#111827',
      bold: true,
      italic: false,
      underline: true,
      rotation: 0,
    },
  ],
}
