import { useCallback, useRef, useState } from 'react'
import type { Annotation } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import type { AnnotationAction as PageAction } from '@/utils/annotationReducer'
import {
  annotationRootReducer,
  cloneAnnotationRootState,
  countAnnotations,
  getPageSlice,
  initialAnnotationRootState,
  rootStatesEqual,
  type AnnotationRootAction,
  type AnnotationRootState,
} from '@/utils/annotationRootReducer'

const HISTORY_LIMIT = 80

type HistoryState = {
  past: AnnotationRootState[]
  present: AnnotationRootState
  future: AnnotationRootState[]
}

const initialHistory: HistoryState = {
  past: [],
  present: initialAnnotationRootState,
  future: [],
}

function recordsHistory(action: AnnotationRootAction): boolean {
  return action.type !== 'select' && action.type !== 'setPageDimensions'
}

export function useAnnotations(currentPageIndex: number) {
  const [history, setHistory] = useState<HistoryState>(initialHistory)
  const transactionStartRef = useRef<AnnotationRootState | null>(null)

  const present = history.present
  const pageSlice = getPageSlice(present, currentPageIndex)
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const applyAction = useCallback(
    (action: AnnotationRootAction, options?: { skipHistory?: boolean }) => {
      setHistory((current) => {
        const nextPresent = annotationRootReducer(current.present, action)
        if (rootStatesEqual(nextPresent, current.present)) {
          return current
        }
        const inTransaction = transactionStartRef.current !== null
        const shouldRecord =
          recordsHistory(action) && !options?.skipHistory && !inTransaction
        if (!shouldRecord) {
          return { ...current, present: nextPresent }
        }
        return {
          past: [...current.past, cloneAnnotationRootState(current.present)].slice(
            -HISTORY_LIMIT,
          ),
          present: nextPresent,
          future: [],
        }
      })
    },
    [],
  )

  const dispatch = useCallback(
    (action: PageAction, options?: { skipHistory?: boolean }) => {
      applyAction({ ...action, pageIndex: currentPageIndex }, options)
    },
    [applyAction, currentPageIndex],
  )

  const beginHistoryTransaction = useCallback(() => {
    if (transactionStartRef.current === null) {
      transactionStartRef.current = cloneAnnotationRootState(history.present)
    }
  }, [history.present])

  const endHistoryTransaction = useCallback(() => {
    const snapshot = transactionStartRef.current
    transactionStartRef.current = null
    if (!snapshot) {
      return
    }
    setHistory((current) => {
      if (rootStatesEqual(snapshot, current.present)) {
        return current
      }
      return {
        past: [...current.past, snapshot].slice(-HISTORY_LIMIT),
        present: current.present,
        future: [],
      }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => {
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
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => {
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
  }, [])

  const reset = useCallback(() => {
    transactionStartRef.current = null
    setHistory(initialHistory)
  }, [])

  const replacePage = useCallback(
    (
      pageIndex: number,
      page: PdfPageDimensions,
      annotations: Annotation[],
    ) => {
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
    (
      pages: Record<number, Annotation[]>,
      pageDimensions: Record<number, PdfPageDimensions>,
    ) => {
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
      applyAction(
        { type: 'setPageDimensions', pageIndex, page },
        { skipHistory: true },
      )
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
