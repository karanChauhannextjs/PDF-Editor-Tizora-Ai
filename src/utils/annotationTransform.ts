import type { Annotation, Point } from '@/types/annotation'
import { MIN_SHAPE_SIZE } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import { textBlockSize } from '@/utils/annotationGeometry'
import { clampFontSize } from '@/utils/annotationStyle'
import { clamp } from '@/utils/coordinates'

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'start' | 'end' | 'radius' | 'text-scale'

export const HANDLE_RADIUS = 6
export const ROTATE_HANDLE_OFFSET = 36

export function annotationRotation(annotation: Annotation): number {
  return annotation.rotation ?? 0
}

/** Top edge center in local (unrotated) space — stem attaches here. */
export function getRotateHandleAnchor(annotation: Annotation): Point | null {
  switch (annotation.type) {
    case 'rectangle':
      return {
        x: annotation.x + annotation.width / 2,
        y: annotation.y,
      }
    case 'line': {
      const minX = Math.min(annotation.start.x, annotation.end.x)
      const maxX = Math.max(annotation.start.x, annotation.end.x)
      const minY = Math.min(annotation.start.y, annotation.end.y)
      return { x: (minX + maxX) / 2, y: minY }
    }
    case 'text': {
      const block = textBlockSize(annotation.text, annotation.fontSize)
      return { x: annotation.x + block.width / 2, y: annotation.y }
    }
    case 'circle':
      return null
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
}

export function getRotateHandlePoint(anchor: Point): Point {
  return { x: anchor.x, y: anchor.y - ROTATE_HANDLE_OFFSET }
}

export function getAnnotationPivot(annotation: Annotation): Point {
  switch (annotation.type) {
    case 'rectangle':
      return {
        x: annotation.x + annotation.width / 2,
        y: annotation.y + annotation.height / 2,
      }
    case 'circle':
      return { x: annotation.cx, y: annotation.cy }
    case 'line':
      return {
        x: (annotation.start.x + annotation.end.x) / 2,
        y: (annotation.start.y + annotation.end.y) / 2,
      }
    case 'text': {
      const block = textBlockSize(annotation.text, annotation.fontSize)
      return {
        x: annotation.x + block.width / 2,
        y: annotation.y + block.height / 2,
      }
    }
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
}

type PageBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function rotatePointAroundPivot(point: Point, pivot: Point, degreesCw: number): Point {
  if (degreesCw === 0) {
    return point
  }
  const rad = (degreesCw * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - pivot.x
  const dy = point.y - pivot.y
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  }
}

function boundsFromPoints(points: readonly Point[]): PageBounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { minX, minY, maxX, maxY }
}

export function getAnnotationPageBounds(annotation: Annotation): PageBounds {
  switch (annotation.type) {
    case 'circle':
      return {
        minX: annotation.cx - annotation.radius,
        minY: annotation.cy - annotation.radius,
        maxX: annotation.cx + annotation.radius,
        maxY: annotation.cy + annotation.radius,
      }
    case 'line':
      return boundsFromPoints([annotation.start, annotation.end])
    case 'rectangle': {
      const pivot = getAnnotationPivot(annotation)
      const rotation = annotationRotation(annotation)
      const corners: Point[] = [
        { x: annotation.x, y: annotation.y },
        { x: annotation.x + annotation.width, y: annotation.y },
        { x: annotation.x, y: annotation.y + annotation.height },
        {
          x: annotation.x + annotation.width,
          y: annotation.y + annotation.height,
        },
      ].map((corner) => rotatePointAroundPivot(corner, pivot, rotation))
      return boundsFromPoints(corners)
    }
    case 'text': {
      const block = textBlockSize(annotation.text, annotation.fontSize)
      const pivot = getAnnotationPivot(annotation)
      const rotation = annotationRotation(annotation)
      const corners: Point[] = [
        { x: annotation.x, y: annotation.y },
        { x: annotation.x + block.width, y: annotation.y },
        { x: annotation.x, y: annotation.y + block.height },
        {
          x: annotation.x + block.width,
          y: annotation.y + block.height,
        },
      ].map((corner) => rotatePointAroundPivot(corner, pivot, rotation))
      return boundsFromPoints(corners)
    }
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
}

export function translateAnnotationByDelta(
  annotation: Annotation,
  dx: number,
  dy: number,
): Annotation {
  switch (annotation.type) {
    case 'rectangle':
      return {
        ...annotation,
        x: annotation.x + dx,
        y: annotation.y + dy,
      }
    case 'circle':
      return {
        ...annotation,
        cx: annotation.cx + dx,
        cy: annotation.cy + dy,
      }
    case 'line':
      return {
        ...annotation,
        start: {
          x: annotation.start.x + dx,
          y: annotation.start.y + dy,
        },
        end: {
          x: annotation.end.x + dx,
          y: annotation.end.y + dy,
        },
      }
    case 'text':
      return {
        ...annotation,
        x: annotation.x + dx,
        y: annotation.y + dy,
      }
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
}

export function clampAnnotationToPage(annotation: Annotation, page: PdfPageDimensions): Annotation {
  const bounds = getAnnotationPageBounds(annotation)
  let shiftX = 0
  let shiftY = 0
  if (bounds.minX < 0) {
    shiftX = -bounds.minX
  } else if (bounds.maxX > page.width) {
    shiftX = page.width - bounds.maxX
  }
  if (bounds.minY < 0) {
    shiftY = -bounds.minY
  } else if (bounds.maxY > page.height) {
    shiftY = page.height - bounds.maxY
  }
  if (shiftX === 0 && shiftY === 0) {
    return annotation
  }
  return translateAnnotationByDelta(annotation, shiftX, shiftY)
}

export function translateAnnotation(
  annotation: Annotation,
  dx: number,
  dy: number,
  page: PdfPageDimensions,
): Annotation {
  const moved = translateAnnotationByDelta(annotation, dx, dy)
  return clampAnnotationToPage(moved, page)
}

export function inverseRotatePoint(point: Point, pivot: Point, degrees: number): Point {
  if (degrees === 0) {
    return point
  }
  const rad = (-degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - pivot.x
  const dy = point.y - pivot.y
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  }
}

export function angleBetweenPoints(origin: Point, target: Point): number {
  return (Math.atan2(target.y - origin.y, target.x - origin.x) * 180) / Math.PI
}

export function resizeAnnotation(
  annotation: Annotation,
  handle: ResizeHandle,
  pointer: Point,
  page: PdfPageDimensions,
): Annotation {
  const pivot = getAnnotationPivot(annotation)
  const local = inverseRotatePoint(pointer, pivot, annotationRotation(annotation))

  let next: Annotation
  switch (annotation.type) {
    case 'rectangle':
      next = resizeRectangle(annotation, handle, local, page)
      break
    case 'circle':
      next = resizeCircle(annotation, handle, local, page)
      break
    case 'line':
      next = resizeLine(annotation, handle, local, page)
      break
    case 'text':
      next = resizeText(annotation, handle, local, page)
      break
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
  return clampAnnotationToPage(next, page)
}

function resizeRectangle(
  annotation: Extract<Annotation, { type: 'rectangle' }>,
  handle: ResizeHandle,
  local: Point,
  page: PdfPageDimensions,
): Annotation {
  if (handle !== 'nw' && handle !== 'ne' && handle !== 'sw' && handle !== 'se') {
    return annotation
  }

  let { x, y, width, height } = annotation
  const right = x + width
  const bottom = y + height

  if (handle.includes('e')) {
    width = clamp(local.x - x, MIN_SHAPE_SIZE, page.width - x)
  }
  if (handle.includes('w')) {
    const newX = clamp(local.x, 0, right - MIN_SHAPE_SIZE)
    width = right - newX
    x = newX
  }
  if (handle.includes('s')) {
    height = clamp(local.y - y, MIN_SHAPE_SIZE, page.height - y)
  }
  if (handle.includes('n')) {
    const newY = clamp(local.y, 0, bottom - MIN_SHAPE_SIZE)
    height = bottom - newY
    y = newY
  }

  return { ...annotation, x, y, width, height }
}

function resizeCircle(
  annotation: Extract<Annotation, { type: 'circle' }>,
  handle: ResizeHandle,
  local: Point,
  page: PdfPageDimensions,
): Annotation {
  if (handle !== 'radius') {
    return annotation
  }
  const maxRadius = Math.min(
    annotation.cx,
    page.width - annotation.cx,
    annotation.cy,
    page.height - annotation.cy,
  )
  const radius = clamp(
    Math.hypot(local.x - annotation.cx, local.y - annotation.cy),
    MIN_SHAPE_SIZE / 2,
    maxRadius,
  )
  return { ...annotation, radius }
}

function resizeLine(
  annotation: Extract<Annotation, { type: 'line' }>,
  handle: ResizeHandle,
  local: Point,
  page: PdfPageDimensions,
): Annotation {
  const clampPoint = (point: Point): Point => ({
    x: clamp(point.x, 0, page.width),
    y: clamp(point.y, 0, page.height),
  })
  if (handle === 'start') {
    return { ...annotation, start: clampPoint(local) }
  }
  if (handle === 'end') {
    return { ...annotation, end: clampPoint(local) }
  }
  return annotation
}

function resizeText(
  annotation: Extract<Annotation, { type: 'text' }>,
  handle: ResizeHandle,
  local: Point,
  page: PdfPageDimensions,
): Annotation {
  if (handle !== 'text-scale' && handle !== 'se') {
    return annotation
  }
  const block = textBlockSize(annotation.text, annotation.fontSize)
  const base = Math.max(block.width, block.height, MIN_SHAPE_SIZE)
  const target = Math.max(local.x - annotation.x, local.y - annotation.y, MIN_SHAPE_SIZE)
  const scale = target / base
  const fontSize = clampFontSize(annotation.fontSize * scale)
  const pivot = getAnnotationPivot(annotation)
  const next: Annotation = { ...annotation, fontSize }
  const nextPivot = getAnnotationPivot(next)
  const dx = pivot.x - nextPivot.x
  const dy = pivot.y - nextPivot.y
  return {
    ...next,
    x: clamp(annotation.x + dx, 0, page.width),
    y: clamp(annotation.y + dy, 0, page.height),
  }
}

function fitsOnPage(annotation: Annotation, page: PdfPageDimensions): boolean {
  const bounds = getAnnotationPageBounds(annotation)
  return (
    bounds.minX >= 0 && bounds.minY >= 0 && bounds.maxX <= page.width && bounds.maxY <= page.height
  )
}

/**
 * When rotation would push corners off the page, nudge position inward.
 * If the rotated AABB is larger than the page, ease rotation back toward
 * the last angle that still fits.
 */
export function rotateAnnotation(
  annotation: Annotation,
  pointer: Point,
  startPointer: Point,
  startRotation: number,
  page: PdfPageDimensions,
): Annotation {
  const pivot = getAnnotationPivot(annotation)
  const startAngle = angleBetweenPoints(pivot, startPointer)
  const currentAngle = angleBetweenPoints(pivot, pointer)
  const targetRotation = startRotation + (currentAngle - startAngle)

  let rotation = targetRotation
  let candidate = clampAnnotationToPage({ ...annotation, rotation }, page)
  if (fitsOnPage(candidate, page)) {
    return candidate
  }

  const towardStart = targetRotation > startRotation ? -1 : 1
  while (Math.abs(rotation - startRotation) > 0.5) {
    rotation += towardStart
    candidate = clampAnnotationToPage({ ...annotation, rotation }, page)
    if (fitsOnPage(candidate, page)) {
      return candidate
    }
  }

  return clampAnnotationToPage({ ...annotation, rotation: startRotation }, page)
}
