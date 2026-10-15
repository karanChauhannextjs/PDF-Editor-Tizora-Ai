import type { Annotation, TextFormat } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import { translateAnnotation } from '@/utils/annotationGeometry'
import { clampFontSize } from '@/utils/annotationStyle'

export type AnnotationState = {
  annotations: Annotation[]
  selectedId: string | null
}

export const initialAnnotationState: AnnotationState = {
  annotations: [],
  selectedId: null,
}

export type AnnotationAction =
  | { type: 'add'; annotation: Annotation }
  | { type: 'delete'; id: string }
  | {
      type: 'move'
      id: string
      dx: number
      dy: number
      page: PdfPageDimensions
    }
  | { type: 'updateText'; id: string; text: string }
  | { type: 'updateStroke'; id: string; stroke: string }
  | { type: 'updateStrokeWidth'; id: string; strokeWidth: number }
  | { type: 'updateTextFormat'; id: string; format: Partial<TextFormat> }
  | { type: 'select'; id: string | null }
  | { type: 'updateAnnotation'; id: string; annotation: Annotation }
  | { type: 'reorder'; id: string; direction: 'forward' | 'backward' }
  | { type: 'replaceAll'; annotations: Annotation[] }
  | { type: 'reset' }

export function annotationReducer(
  state: AnnotationState,
  action: AnnotationAction,
): AnnotationState {
  switch (action.type) {
    case 'add':
      return {
        annotations: [...state.annotations, action.annotation],
        selectedId: action.annotation.id,
      }
    case 'delete':
      return {
        annotations: state.annotations.filter((annotation) => annotation.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      }
    case 'move': {
      const existing = state.annotations.find((annotation) => annotation.id === action.id)
      if (!existing) {
        return state
      }
      return {
        ...state,
        annotations: state.annotations.map((annotation) =>
          annotation.id === action.id
            ? translateAnnotation(annotation, action.dx, action.dy, action.page)
            : annotation,
        ),
      }
    }
    case 'updateText': {
      if (action.text.trim().length === 0) {
        return state
      }
      const existing = state.annotations.find(
        (annotation) => annotation.id === action.id && annotation.type === 'text',
      )
      if (!existing) {
        return state
      }
      return {
        ...state,
        annotations: state.annotations.map((annotation) =>
          annotation.id === action.id && annotation.type === 'text'
            ? { ...annotation, text: action.text }
            : annotation,
        ),
      }
    }
    case 'updateStroke': {
      const existing = state.annotations.find((annotation) => annotation.id === action.id)
      if (!existing || existing.type === 'text') {
        return state
      }
      if (existing.stroke === action.stroke) {
        return state
      }
      return {
        ...state,
        annotations: state.annotations.map((annotation) =>
          annotation.id === action.id && annotation.type !== 'text'
            ? { ...annotation, stroke: action.stroke }
            : annotation,
        ),
      }
    }
    case 'updateStrokeWidth': {
      const existing = state.annotations.find((annotation) => annotation.id === action.id)
      if (!existing || existing.type === 'text') {
        return state
      }
      if (existing.strokeWidth === action.strokeWidth) {
        return state
      }
      return {
        ...state,
        annotations: state.annotations.map((annotation) =>
          annotation.id === action.id && annotation.type !== 'text'
            ? { ...annotation, strokeWidth: action.strokeWidth }
            : annotation,
        ),
      }
    }
    case 'updateTextFormat': {
      const existing = state.annotations.find(
        (annotation) => annotation.id === action.id && annotation.type === 'text',
      )
      if (!existing) {
        return state
      }
      const format = { ...action.format }
      if (format.fontSize !== undefined) {
        format.fontSize = clampFontSize(format.fontSize)
      }
      return {
        ...state,
        annotations: state.annotations.map((annotation) =>
          annotation.id === action.id && annotation.type === 'text'
            ? { ...annotation, ...format }
            : annotation,
        ),
      }
    }
    case 'select':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id }
    case 'updateAnnotation': {
      if (action.annotation.id !== action.id) {
        return state
      }
      const exists = state.annotations.some((annotation) => annotation.id === action.id)
      if (!exists) {
        return state
      }
      const next =
        action.annotation.type === 'text'
          ? {
              ...action.annotation,
              fontSize: clampFontSize(action.annotation.fontSize),
            }
          : action.annotation
      return {
        ...state,
        annotations: state.annotations.map((annotation) =>
          annotation.id === action.id ? next : annotation,
        ),
      }
    }
    case 'reorder': {
      const index = state.annotations.findIndex((annotation) => annotation.id === action.id)
      if (index === -1) {
        return state
      }
      const target = action.direction === 'forward' ? index + 1 : index - 1
      if (target < 0 || target >= state.annotations.length) {
        return state
      }
      const next = [...state.annotations]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return { ...state, annotations: next }
    }
    case 'replaceAll':
      return {
        annotations: action.annotations,
        selectedId: null,
      }
    case 'reset':
      return initialAnnotationState
    default: {
      const unreachable: never = action
      return unreachable
    }
  }
}
