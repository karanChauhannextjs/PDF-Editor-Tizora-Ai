import type { Annotation, Point } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import {
  ANNOTATION_DOCUMENT_VERSION,
  ANNOTATION_DOCUMENT_VERSION_MULTI,
  type AnnotationDocument,
  type AnnotationDocumentV2,
  type ValidationResult,
} from '@/types/persistence'
import type { AnnotationRootState } from '@/utils/annotationRootReducer'
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '@/utils/annotationStyle'

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const ANNOTATION_TYPES = ['rectangle', 'circle', 'line', 'text'] as const

export function serializeAnnotationDocument(annotationDocument: AnnotationDocument): string {
  return JSON.stringify(annotationDocument, null, 2)
}

export function parseAnnotationDocument(serialized: string): ValidationResult {
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch (error) {
    console.error('Annotation JSON could not be parsed', error)
    return { ok: false, message: 'The file is not valid JSON.' }
  }
  return validateAnnotationDocument(value)
}

export function validateAnnotationDocument(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      message: 'The annotation file has an unexpected format.',
    }
  }
  if (value.version === ANNOTATION_DOCUMENT_VERSION) {
    return validateSinglePageDocument(value)
  }
  if (value.version === ANNOTATION_DOCUMENT_VERSION_MULTI) {
    return validateMultiPageDocument(value)
  }
  return {
    ok: false,
    message: 'This annotation file uses an unsupported version.',
  }
}

function validateSinglePageDocument(value: Record<string, unknown>): ValidationResult {
  const page = readPage(value.page)
  if (!page) {
    return {
      ok: false,
      message: 'The annotation file is missing page dimensions.',
    }
  }
  if (!Array.isArray(value.annotations)) {
    return {
      ok: false,
      message: 'The annotation file does not contain an annotation list.',
    }
  }
  const parsed = readAnnotationList(value.annotations)
  if (!parsed.ok) {
    return parsed
  }
  return {
    ok: true,
    import: {
      format: 'single',
      page,
      annotations: parsed.annotations,
    },
  }
}

function validateMultiPageDocument(value: Record<string, unknown>): ValidationResult {
  if (!Array.isArray(value.pages) || value.pages.length === 0) {
    return {
      ok: false,
      message: 'The annotation file does not contain any pages.',
    }
  }
  const pages: Record<number, { page: PdfPageDimensions; annotations: Annotation[] }> = {}
  const seenIds = new Set<string>()
  for (const entry of value.pages) {
    if (!isRecord(entry)) {
      return {
        ok: false,
        message: 'The annotation file contains an invalid page entry.',
      }
    }
    if (!isFiniteNumber(entry.pageIndex) || entry.pageIndex < 1) {
      return {
        ok: false,
        message: 'The annotation file contains an invalid page number.',
      }
    }
    const page = readPage(entry.page)
    if (!page) {
      return {
        ok: false,
        message: 'The annotation file is missing page dimensions.',
      }
    }
    if (!Array.isArray(entry.annotations)) {
      return {
        ok: false,
        message: 'The annotation file does not contain an annotation list.',
      }
    }
    const parsed = readAnnotationList(entry.annotations, seenIds)
    if (!parsed.ok) {
      return parsed
    }
    pages[entry.pageIndex] = { page, annotations: parsed.annotations }
  }
  return {
    ok: true,
    import: { format: 'multi', pages },
  }
}

function readAnnotationList(
  entries: unknown[],
  seenIds = new Set<string>(),
): { ok: true; annotations: Annotation[] } | { ok: false; message: string } {
  const annotations: Annotation[] = []
  for (const entry of entries) {
    const annotation = readAnnotation(entry)
    if (!annotation) {
      return {
        ok: false,
        message: unsupportedOrInvalidMessage(entry),
      }
    }
    if (seenIds.has(annotation.id)) {
      return {
        ok: false,
        message: 'The annotation file contains duplicate annotation ids.',
      }
    }
    seenIds.add(annotation.id)
    annotations.push(annotation)
  }
  return { ok: true, annotations }
}

export function buildAnnotationDocumentFromRoot(state: AnnotationRootState): AnnotationDocumentV2 {
  const pageIndexes = new Set<number>([
    ...Object.keys(state.pages).map(Number),
    ...Object.keys(state.pageDimensions).map(Number),
  ])
  const pages = [...pageIndexes]
    .sort((left, right) => left - right)
    .flatMap((pageIndex) => {
      const slice = state.pages[pageIndex]
      const annotations = slice?.annotations ?? []
      if (annotations.length === 0) {
        return []
      }
      const dimensions = state.pageDimensions[pageIndex]
      if (!dimensions) {
        return []
      }
      return [{ pageIndex, page: dimensions, annotations }]
    })
  return {
    version: ANNOTATION_DOCUMENT_VERSION_MULTI,
    pages,
  }
}

export function downloadAnnotationDocument(
  annotationDocument: AnnotationDocument,
  filename = `annotations-${Date.now()}.json`,
): void {
  downloadAnnotationJson(serializeAnnotationDocument(annotationDocument), filename)
}

export function downloadAnnotationJson(json: string, filename: string): void {
  downloadBlob(new Blob([json], { type: 'application/json' }), filename)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  window.document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function unsupportedOrInvalidMessage(entry: unknown): string {
  if (
    isRecord(entry) &&
    typeof entry.type === 'string' &&
    !ANNOTATION_TYPES.includes(entry.type as (typeof ANNOTATION_TYPES)[number])
  ) {
    return 'The annotation file contains an unsupported annotation type.'
  }
  return 'The annotation file contains an invalid annotation.'
}

function readPage(value: unknown): PdfPageDimensions | null {
  if (!isRecord(value) || !isPositive(value.width) || !isPositive(value.height)) {
    return null
  }
  return { width: value.width, height: value.height }
}

function readAnnotation(value: unknown): Annotation | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null
  }
  const id = readId(value.id)
  if (!id) {
    return null
  }

  switch (value.type) {
    case 'rectangle':
      return readRectangle(id, value)
    case 'circle':
      return readCircle(id, value)
    case 'line':
      return readLine(id, value)
    case 'text':
      return readTextAnnotation(id, value)
    default:
      return null
  }
}

function readRectangle(id: string, value: Record<string, unknown>): Annotation | null {
  const stroke = readColor(value.stroke)
  const strokeWidth = readStrokeWidth(value.strokeWidth)
  if (
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.width) ||
    !isFiniteNumber(value.height) ||
    value.width < 0 ||
    value.height < 0 ||
    !stroke ||
    strokeWidth === null
  ) {
    return null
  }
  return {
    id,
    type: 'rectangle',
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    stroke,
    strokeWidth,
    rotation: readRotation(value),
  }
}

function readCircle(id: string, value: Record<string, unknown>): Annotation | null {
  const stroke = readColor(value.stroke)
  const strokeWidth = readStrokeWidth(value.strokeWidth)
  if (
    !isFiniteNumber(value.cx) ||
    !isFiniteNumber(value.cy) ||
    !isPositive(value.radius) ||
    !stroke ||
    strokeWidth === null
  ) {
    return null
  }
  return {
    id,
    type: 'circle',
    cx: value.cx,
    cy: value.cy,
    radius: value.radius,
    stroke,
    strokeWidth,
    rotation: readRotation(value),
  }
}

function readLine(id: string, value: Record<string, unknown>): Annotation | null {
  const stroke = readColor(value.stroke)
  const strokeWidth = readStrokeWidth(value.strokeWidth)
  const start = readPoint(value.start)
  const end = readPoint(value.end)
  if (!start || !end || !stroke || strokeWidth === null) {
    return null
  }
  return {
    id,
    type: 'line',
    start,
    end,
    stroke,
    strokeWidth,
    rotation: readRotation(value),
  }
}

function readTextAnnotation(id: string, value: Record<string, unknown>): Annotation | null {
  const color = readColor(value.color)
  const text = readText(value.text)
  if (
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.fontSize) ||
    value.fontSize < MIN_FONT_SIZE ||
    value.fontSize > MAX_FONT_SIZE ||
    !color ||
    !text
  ) {
    return null
  }
  return {
    id,
    type: 'text',
    x: value.x,
    y: value.y,
    text,
    fontSize: value.fontSize,
    color,
    bold: value.bold === true,
    italic: value.italic === true,
    underline: value.underline === true,
    rotation: readRotation(value),
  }
}

function readPoint(value: unknown): Point | null {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    return null
  }
  return { x: value.x, y: value.y }
}

function readId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const id = value.trim()
  if (id.length === 0 || id.length > 100) {
    return null
  }
  return id
}

function readRotation(value: Record<string, unknown>): number {
  if (value.rotation === undefined) {
    return 0
  }
  if (!isFiniteNumber(value.rotation)) {
    return 0
  }
  return value.rotation
}

function readColor(value: unknown): string | null {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    return null
  }
  return value
}

function readStrokeWidth(value: unknown): number | null {
  if (!isFiniteNumber(value) || value <= 0 || value > 24) {
    return null
  }
  return value
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const text = value.replaceAll('\r\n', '\n')
  if (text.trim().length === 0 || text.length > 2000) {
    return null
  }
  return text
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}
