import type { Annotation } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'

export const ANNOTATION_DOCUMENT_VERSION = 1
export const ANNOTATION_DOCUMENT_VERSION_MULTI = 2

export type AnnotationDocumentV1 = {
  version: typeof ANNOTATION_DOCUMENT_VERSION
  page: PdfPageDimensions
  annotations: Annotation[]
}

export type AnnotationPageEntry = {
  pageIndex: number
  page: PdfPageDimensions
  annotations: Annotation[]
}

export type AnnotationDocumentV2 = {
  version: typeof ANNOTATION_DOCUMENT_VERSION_MULTI
  pages: AnnotationPageEntry[]
}

export type AnnotationDocument = AnnotationDocumentV1 | AnnotationDocumentV2

export type ParsedAnnotationImport =
  | {
      format: 'single'
      page: PdfPageDimensions
      annotations: Annotation[]
    }
  | {
      format: 'multi'
      pages: Record<number, { page: PdfPageDimensions; annotations: Annotation[] }>
    }

export type ValidationSuccess = {
  ok: true
  import: ParsedAnnotationImport
}

export type ValidationFailure = {
  ok: false
  message: string
}

export type ValidationResult = ValidationSuccess | ValidationFailure
