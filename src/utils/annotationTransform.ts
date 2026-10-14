import type { Annotation, Point } from '@/types/annotation'
import { MIN_SHAPE_SIZE } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import { textBlockSize } from '@/utils/annotationGeometry'
import { clampFontSize } from '@/utils/annotationStyle'
import { clamp } from '@/utils/coordinates'

export type ResizeHandle =
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se'
  | 'start'
  | 'end'
  | 'radius'
  | 'text-scale'

export const HANDLE_RADIUS = 6
export const ROTATE_HANDLE_OFFSET = 36

export function annotationRotation(annotation: Annotation): number {
  return annotation.rotation ?? 0
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

export function inverseRotatePoint(
  point: Point,
  pivot: Point,
  degrees: number,
): Point {
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

  switch (annotation.type) {
    case 'rectangle':
      return resizeRectangle(annotation, handle, local, page)
    case 'circle':
      return resizeCircle(annotation, handle, local, page)
    case 'line':
      return resizeLine(annotation, handle, local, page)
    case 'text':
      return resizeText(annotation, handle, local, page)
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
}

function resizeRectangle(
  annotation: Extract<Annotation, { type: 'rectangle' }>,
  handle: ResizeHandle,
  local: Point,
  page: PdfPageDimensions,
): Annotation {
  if (
    handle !== 'nw' &&
    handle !== 'ne' &&
    handle !== 'sw' &&
    handle !== 'se'
  ) {
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
  const target = Math.max(
    local.x - annotation.x,
    local.y - annotation.y,
    MIN_SHAPE_SIZE,
  )
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

export function rotateAnnotation(
  annotation: Annotation,
  pointer: Point,
  startPointer: Point,
  startRotation: number,
): Annotation {
  const pivot = getAnnotationPivot(annotation)
  const startAngle = angleBetweenPoints(pivot, startPointer)
  const currentAngle = angleBetweenPoints(pivot, pointer)
  const rotation = startRotation + (currentAngle - startAngle)
  return { ...annotation, rotation }
}
