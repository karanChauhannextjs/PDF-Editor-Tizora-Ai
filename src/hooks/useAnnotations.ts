import { useCallback, useRef } from 'react'
import type { Annotation } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import { useEditorSessionStore } from '@/stores/editorSessionStore'
import type { AnnotationAction as PageAction } from '@/utils/annotationReducer'
import {
  annotationRootReducer,
  cloneAnnotationRootState,
  countAnnotations,
  getPageSlice,
  rootStatesEqual,
  type AnnotationRootAction,
  type AnnotationRootState,
} from '@/utils/annotationRootReducer'

const HISTORY_LIMIT = 80

function recordsHistory(action: AnnotationRootAction): boolean {
  return action.type !== 'select' && action.type !== 'setPageDimensions'
}

export function useAnnotations(currentPageIndex: number) {
  const history = useEditorSessionStore((state) => state.annotationHistory)
  const setAnnotationHistory = useEditorSessionStore((state) => state.setAnnotationHistory)
  const resetAnnotationsInStore = useEditorSessionStore((state) => state.resetAnnotations)
  const transactionStartRef = useRef<AnnotationRootState | null>(null)

  const present = history.present
  const pageSlice = getPageSlice(present, currentPageIndex)
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const applyAction = useCallback(
    (action: AnnotationRootAction, options?: { skipHistory?: boolean }) => {
      setAnnotationHistory((current) => {
        const nextPresent = annotationRootReducer(current.present, action)
        if (rootStatesEqual(nextPresent, current.present)) {
          return current
        }
        const inTransaction = transactionStartRef.current !== null
        const shouldRecord = recordsHistory(action) && !options?.skipHistory && !inTransaction
        if (!shouldRecord) {
          return { ...current, present: nextPresent }
        }
        return {
          past: [...current.past, cloneAnnotationRootState(current.present)].slice(-HISTORY_LIMIT),
          present: nextPresent,
          future: [],
        }
      })
    },
    [setAnnotationHistory],
  )

  const dispatch = useCallback(
    (action: PageAction, options?: { skipHistory?: boolean }) => {
      applyAction({ ...action, pageIndex: currentPageIndex }, options)
    },
    [applyAction, currentPageIndex],
  )

  const beginHistoryTransaction = useCallback(() => {
    if (transactionStartRef.current === null) {
      const present = useEditorSessionStore.getState().annotationHistory.present
      transactionStartRef.current = cloneAnnotationRootState(present)
    }
  }, [])

  const endHistoryTransaction = useCallback(() => {
    const snapshot = transactionStartRef.current
    transactionStartRef.current = null
    if (!snapshot) {
      return
    }
    setAnnotationHistory((current) => {
      if (rootStatesEqual(snapshot, current.present)) {
        return current
      }
      return {
        past: [...current.past, snapshot].slice(-HISTORY_LIMIT),
        present: current.present,
        future: [],
      }
    })
  }, [setAnnotationHistory])

  const cancelHistoryTransaction = useCallback(() => {
    transactionStartRef.current = null
  }, [])

  const undo = useCallback(() => {
    transactionStartRef.current = null
    setAnnotationHistory((current) => {
      if (current.past.length === 0) {
        return current
      }
      const previous = current.past[current.past.length - 1]
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [cloneAnnotationRootState(current.present), ...current.future],
      }
    })
  }, [setAnnotationHistory])

  const redo = useCallback(() => {
    transactionStartRef.current = null
    setAnnotationHistory((current) => {
      if (current.future.length === 0) {
        return current
      }
      const [next, ...future] = current.future
      return {
        past: [...current.past, cloneAnnotationRootState(current.present)],
        present: next,
        future,
      }
    })
  }, [setAnnotationHistory])

  const reset = useCallback(() => {
    transactionStartRef.current = null
    resetAnnotationsInStore()
  }, [resetAnnotationsInStore])

  const replacePage = useCallback(
    (pageIndex: number, page: PdfPageDimensions, annotations: Annotation[]) => {
      applyAction({
        type: 'replacePage',
        pageIndex,
        page,
        annotations,
      })
    },
    [applyAction],
  )

  const replaceDocument = useCallback(
    (pages: Record<number, Annotation[]>, pageDimensions: Record<number, PdfPageDimensions>) => {
      applyAction({
        type: 'replaceDocument',
        pages,
        pageDimensions,
      })
    },
    [applyAction],
  )

  const setPageDimensions = useCallback(
    (pageIndex: number, page: PdfPageDimensions) => {
      applyAction({ type: 'setPageDimensions', pageIndex, page }, { skipHistory: true })
    },
    [applyAction],
  )

  const exportRootState = useCallback(() => history.present, [history.present])

  return {
    annotations: pageSlice.annotations,
    selectedId: pageSlice.selectedId,
    dispatch,
    beginHistoryTransaction,
    endHistoryTransaction,
    cancelHistoryTransaction,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    replacePage,
    replaceDocument,
    setPageDimensions,
    exportRootState,
    totalAnnotationCount: countAnnotations(present),
  }
}
