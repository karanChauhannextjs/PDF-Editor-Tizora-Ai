import type {
  Annotation,
  AnnotationTool,
  CircleAnnotation,
  LineAnnotation,
  Point,
  RectangleAnnotation,
  TextAnnotation,
} from '@/types/annotation'
import {
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  MIN_SHAPE_SIZE,
} from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import { clampFontSize } from '@/utils/annotationStyle'
import { clamp } from '@/utils/coordinates'

export type ShapeDraft =
  | Pick<RectangleAnnotation, 'type' | 'x' | 'y' | 'width' | 'height'>
  | Pick<CircleAnnotation, 'type' | 'cx' | 'cy' | 'radius'>
  | Pick<LineAnnotation, 'type' | 'start' | 'end'>

export function rectangleFromDrag(start: Point, end: Point): ShapeDraft {
  return {
    type: 'rectangle',
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

/**
 * The drag segment is the circle's diameter. The center is the midpoint and
 * the radius is half the distance, then the circle is pulled inside the page.
 */
export function circleFromDrag(
  start: Point,
  end: Point,
  page: PdfPageDimensions,
): ShapeDraft {
  const cx = (start.x + end.x) / 2
  const cy = (start.y + end.y) / 2
  const radius = Math.hypot(end.x - start.x, end.y - start.y) / 2
  const maxRadius = Math.min(page.width, page.height) / 2
  const fittedRadius = clamp(radius, 0, maxRadius)

  return {
    type: 'circle',
    cx: clamp(cx, fittedRadius, page.width - fittedRadius),
    cy: clamp(cy, fittedRadius, page.height - fittedRadius),
    radius: fittedRadius,
  }
}

export function lineFromDrag(start: Point, end: Point): ShapeDraft {
  return {
    type: 'line',
    start: { ...start },
    end: { ...end },
  }
}

export function shapeDraftFromDrag(
  tool: AnnotationTool,
  start: Point,
  end: Point,
  page: PdfPageDimensions,
): ShapeDraft | null {
  switch (tool) {
    case 'rectangle':
      return rectangleFromDrag(start, end)
    case 'circle':
      return circleFromDrag(start, end, page)
    case 'line':
      return lineFromDrag(start, end)
    case 'select':
    case 'text':
      return null
    default: {
      const unreachable: never = tool
      return unreachable
    }
  }
}

export function isSignificantShape(draft: ShapeDraft): boolean {
  switch (draft.type) {
    case 'rectangle':
      return draft.width >= MIN_SHAPE_SIZE || draft.height >= MIN_SHAPE_SIZE
    case 'circle':
      return draft.radius * 2 >= MIN_SHAPE_SIZE
    case 'line':
      return (
        Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y) >=
        MIN_SHAPE_SIZE
      )
    default: {
      const unreachable: never = draft
      return unreachable
    }
  }
}

export function annotationFromDraft(
  draft: ShapeDraft,
  stroke: string = DEFAULT_STROKE,
  strokeWidth: number = DEFAULT_STROKE_WIDTH,
): Annotation {
  const id = crypto.randomUUID()
  switch (draft.type) {
    case 'rectangle':
      return {
        ...draft,
        id,
        stroke,
        strokeWidth,
        rotation: 0,
      }
    case 'circle':
      return {
        ...draft,
        id,
        stroke,
        strokeWidth,
        rotation: 0,
      }
    case 'line':
      return {
        ...draft,
        id,
        stroke,
        strokeWidth,
        rotation: 0,
      }
    default: {
      const unreachable: never = draft
      return unreachable
    }
  }
}

export { translateAnnotation } from '@/utils/annotationTransform'

export function textBlockSize(text: string, fontSize: number) {
  const lines = text.split('\n')
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 1)
  return {
    width: Math.max(fontSize, longest * fontSize * 0.55),
    height: Math.max(fontSize, lines.length * fontSize),
  }
}

export function scaleAnnotationsToPage(
  annotations: readonly Annotation[],
  source: PdfPageDimensions,
  target: PdfPageDimensions,
): Annotation[] {
  const scaleX = target.width / source.width
  const scaleY = target.height / source.height
  const uniform = (scaleX + scaleY) / 2

  return annotations.map((annotation) =>
    scaleAnnotation(annotation, scaleX, scaleY, uniform, target),
  )
}

function scaleAnnotation(
  annotation: Annotation,
  scaleX: number,
  scaleY: number,
  uniform: number,
  page: PdfPageDimensions,
): Annotation {
  switch (annotation.type) {
    case 'rectangle': {
      const width = clamp(annotation.width * scaleX, 0, page.width)
      const height = clamp(annotation.height * scaleY, 0, page.height)
      return {
        ...annotation,
        width,
        height,
        x: clamp(annotation.x * scaleX, 0, page.width - width),
        y: clamp(annotation.y * scaleY, 0, page.height - height),
        strokeWidth: clamp(annotation.strokeWidth * uniform, 0.5, 24),
      }
    }
    case 'circle': {
      const radius = clamp(
        annotation.radius * uniform,
        0,
        Math.min(page.width, page.height) / 2,
      )
      return {
        ...annotation,
        radius,
        cx: clamp(annotation.cx * scaleX, radius, page.width - radius),
        cy: clamp(annotation.cy * scaleY, radius, page.height - radius),
        strokeWidth: clamp(annotation.strokeWidth * uniform, 0.5, 24),
      }
    }
    case 'line':
      return {
        ...annotation,
        start: {
          x: clamp(annotation.start.x * scaleX, 0, page.width),
          y: clamp(annotation.start.y * scaleY, 0, page.height),
        },
        end: {
          x: clamp(annotation.end.x * scaleX, 0, page.width),
          y: clamp(annotation.end.y * scaleY, 0, page.height),
        },
        strokeWidth: clamp(annotation.strokeWidth * uniform, 0.5, 24),
      }
    case 'text':
      return {
        ...annotation,
        x: clamp(annotation.x * scaleX, 0, page.width),
        y: clamp(annotation.y * scaleY, 0, page.height),
        fontSize: clampFontSize(annotation.fontSize * uniform),
      }
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
}

export function annotationKindLabel(annotation: Annotation): string {
  switch (annotation.type) {
    case 'rectangle':
      return 'Rectangle'
    case 'circle':
      return 'Circle'
    case 'line':
      return 'Line'
    case 'text':
      return 'Text'
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
}

export function isTextAnnotation(
  annotation: Annotation,
): annotation is TextAnnotation {
  return annotation.type === 'text'
}
