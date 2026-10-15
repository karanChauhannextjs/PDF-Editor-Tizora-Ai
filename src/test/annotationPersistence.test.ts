import { describe, expect, it, vi } from 'vitest'
import { SAMPLE_ANNOTATION_DOCUMENT } from '@/data/sampleAnnotationDocument'
import {
  ANNOTATION_DOCUMENT_VERSION,
  ANNOTATION_DOCUMENT_VERSION_MULTI,
  type AnnotationDocumentV1,
} from '@/types/persistence'
import { parseAnnotationDocument, serializeAnnotationDocument } from '@/utils/annotationPersistence'

const documentV1 = {
  version: ANNOTATION_DOCUMENT_VERSION,
  page: { width: 612, height: 792 },
  annotations: [
    {
      id: 'rect-1',
      type: 'rectangle' as const,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      stroke: '#1d4ed8',
      strokeWidth: 2,
      rotation: 0,
    },
  ],
} satisfies AnnotationDocumentV1

describe('annotation persistence', () => {
  it('serializes a versioned document and restores it', () => {
    const serialized = serializeAnnotationDocument(documentV1)
    const parsed = parseAnnotationDocument(serialized)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    expect(parsed.import.format).toBe('single')
    if (parsed.import.format !== 'single') {
      return
    }
    expect(parsed.import.page).toEqual(documentV1.page)
    expect(parsed.import.annotations).toEqual(documentV1.annotations)
  })

  it('ships a sample document with every annotation type', () => {
    const serialized = serializeAnnotationDocument(SAMPLE_ANNOTATION_DOCUMENT)
    const parsed = parseAnnotationDocument(serialized)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    expect(parsed.import.format).toBe('single')
    if (parsed.import.format !== 'single') {
      return
    }
    expect(parsed.import.annotations).toHaveLength(4)
    expect(parsed.import.annotations.map((item) => item.type).sort()).toEqual([
      'circle',
      'line',
      'rectangle',
      'text',
    ])
  })

  it('imports multi-page version 2 documents', () => {
    const serialized = serializeAnnotationDocument({
      version: ANNOTATION_DOCUMENT_VERSION_MULTI,
      pages: [
        {
          pageIndex: 1,
          page: { width: 600, height: 800 },
          annotations: documentV1.annotations,
        },
        {
          pageIndex: 2,
          page: { width: 600, height: 800 },
          annotations: [],
        },
      ],
    })
    const parsed = parseAnnotationDocument(serialized)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    expect(parsed.import.format).toBe('multi')
  })

  it('rejects malformed JSON and unsupported annotation types', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const malformed = parseAnnotationDocument('{')
    expect(malformed).toEqual({
      ok: false,
      message: 'The file is not valid JSON.',
    })

    const unsupported = parseAnnotationDocument(
      JSON.stringify({
        version: 1,
        page: { width: 100, height: 100 },
        annotations: [
          {
            id: 'ink-1',
            type: 'ink',
            points: [],
          },
        ],
      }),
    )
    expect(unsupported).toEqual({
      ok: false,
      message: 'The annotation file contains an unsupported annotation type.',
    })
    expect(errorSpy).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })
})
