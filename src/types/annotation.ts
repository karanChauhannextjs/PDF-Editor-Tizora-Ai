export type Point = {
  x: number
  y: number
}

export type AnnotationTool = 'select' | 'rectangle' | 'circle' | 'line' | 'text'

type AnnotationBase = {
  id: string
  /** Degrees clockwise around the annotation pivot. */
  rotation: number
}

export type RectangleAnnotation = AnnotationBase & {
  type: 'rectangle'
  x: number
  y: number
  width: number
  height: number
  stroke: string
  strokeWidth: number
}

export type CircleAnnotation = AnnotationBase & {
  type: 'circle'
  cx: number
  cy: number
  radius: number
  stroke: string
  strokeWidth: number
}

export type LineAnnotation = AnnotationBase & {
  type: 'line'
  start: Point
  end: Point
  stroke: string
  strokeWidth: number
}

export type TextAnnotation = AnnotationBase & {
  type: 'text'
  x: number
  y: number
  text: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
}

export type TextFormat = Pick<
  TextAnnotation,
  'fontSize' | 'color' | 'bold' | 'italic' | 'underline'
>

export type Annotation = RectangleAnnotation | CircleAnnotation | LineAnnotation | TextAnnotation

export const DEFAULT_STROKE = '#1d4ed8'
export const DEFAULT_STROKE_WIDTH = 2
export const DEFAULT_FONT_SIZE = 16
export const DEFAULT_TEXT_COLOR = '#111827'
export const MIN_SHAPE_SIZE = 2

export const DEFAULT_TEXT_FORMAT: TextFormat = {
  fontSize: DEFAULT_FONT_SIZE,
  color: DEFAULT_TEXT_COLOR,
  bold: false,
  italic: false,
  underline: false,
}
