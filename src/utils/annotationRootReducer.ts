import type { Annotation } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import {
  annotationReducer,
  type AnnotationAction as PageAction,
  type AnnotationState,
} from '@/utils/annotationReducer'

export type AnnotationRootState = {
  pages: Record<number, AnnotationState>
  pageDimensions: Record<number, PdfPageDimensions>
}

export const initialAnnotationRootState: AnnotationRootState = {
  pages: {},
  pageDimensions: {},
}

export type AnnotationRootAction =
  | (PageAction & { pageIndex: number })
  | {
      type: 'replacePage'
      pageIndex: number
      page: PdfPageDimensions
      annotations: Annotation[]
    }
  | {
      type: 'replaceDocument'
      pages: Record<number, Annotation[]>
      pageDimensions: Record<number, PdfPageDimensions>
    }
  | { type: 'setPageDimensions'; pageIndex: number; page: PdfPageDimensions }
  | { type: 'reset' }

export function annotationRootReducer(
  state: AnnotationRootState,
  action: AnnotationRootAction,
): AnnotationRootState {
  switch (action.type) {
    case 'reset':
      return initialAnnotationRootState
    case 'setPageDimensions':
      return {
        ...state,
        pageDimensions: {
          ...state.pageDimensions,
          [action.pageIndex]: action.page,
        },
      }
    case 'replaceDocument':
      return {
        pages: Object.fromEntries(
          Object.entries(action.pages).map(([pageIndex, annotations]) => [
            Number(pageIndex),
            { annotations, selectedId: null },
          ]),
        ),
        pageDimensions: action.pageDimensions,
      }
    case 'replacePage':
      return {
        ...state,
        pageDimensions: {
          ...state.pageDimensions,
          [action.pageIndex]: action.page,
        },
        pages: {
          ...state.pages,
          [action.pageIndex]: {
            annotations: action.annotations,
            selectedId: null,
          },
        },
      }
    case 'select':
    case 'add':
    case 'delete':
    case 'move':
    case 'updateText':
    case 'updateStroke':
    case 'updateStrokeWidth':
    case 'updateTextFormat':
    case 'updateAnnotation':
    case 'reorder':
    case 'replaceAll': {
      const pageIndex = action.pageIndex
      const slice = state.pages[pageIndex] ?? {
        annotations: [],
        selectedId: null,
      }
      const pageAction = stripPageIndex(action)
      const nextSlice = annotationReducer(slice, pageAction)
      if (nextSlice === slice) {
        return state
      }
      return {
        ...state,
        pages: {
          ...state.pages,
          [pageIndex]: nextSlice,
        },
      }
    }
    default: {
      const unreachable: never = action
      return unreachable
    }
  }
}

function stripPageIndex(
  action: PageAction & { pageIndex: number },
): PageAction {
  const { pageIndex, ...pageAction } = action
  void pageIndex
  return pageAction as PageAction
}

export function cloneAnnotationRootState(
  state: AnnotationRootState,
): AnnotationRootState {
  return {
    pageDimensions: { ...state.pageDimensions },
    pages: Object.fromEntries(
      Object.entries(state.pages).map(([pageIndex, slice]) => [
        Number(pageIndex),
        {
          annotations: slice.annotations.map((annotation) => ({ ...annotation })),
          selectedId: slice.selectedId,
        },
      ]),
    ),
  }
}

export function rootStatesEqual(
  left: AnnotationRootState,
  right: AnnotationRootState,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function getPageSlice(
  state: AnnotationRootState,
  pageIndex: number,
): AnnotationState {
  return state.pages[pageIndex] ?? { annotations: [], selectedId: null }
}

export function countAnnotations(state: AnnotationRootState): number {
  return Object.values(state.pages).reduce(
    (total, slice) => total + slice.annotations.length,
    0,
  )
}
