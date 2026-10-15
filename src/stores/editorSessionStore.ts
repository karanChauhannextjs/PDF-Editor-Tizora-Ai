import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PdfPageDimensions } from '@/types/pdf'
import {
  cloneAnnotationRootState,
  initialAnnotationRootState,
  type AnnotationRootState,
} from '@/utils/annotationRootReducer'
import { createIdbStorage } from '@/utils/idbStorage'

export const EDITOR_SESSION_STORAGE_KEY = 'tizora-editor-session-v1'

export type AnnotationHistoryState = {
  past: AnnotationRootState[]
  present: AnnotationRootState
  future: AnnotationRootState[]
}

export type PdfSession = {
  fileName: string
  pdfData: number[]
  currentPageIndex: number
}

type EditorSessionState = {
  annotationHistory: AnnotationHistoryState
  pdfSession: PdfSession | null
  blankPage: PdfPageDimensions | null
  hasHydrated: boolean
  setAnnotationHistory: (
    updater: (current: AnnotationHistoryState) => AnnotationHistoryState,
  ) => void
  resetAnnotations: () => void
  setPdfSession: (session: PdfSession | null) => void
  setBlankPage: (page: PdfPageDimensions | null) => void
  setHasHydrated: (value: boolean) => void
  clearPersistedSession: () => void
}

const initialHistory: AnnotationHistoryState = {
  past: [],
  present: initialAnnotationRootState,
  future: [],
}

export const useEditorSessionStore = create<EditorSessionState>()(
  persist(
    (set) => ({
      annotationHistory: initialHistory,
      pdfSession: null,
      blankPage: null,
      hasHydrated: Boolean(import.meta.env.VITEST),
      setAnnotationHistory: (updater) => {
        set((state) => ({
          annotationHistory: updater(state.annotationHistory),
        }))
      },
      resetAnnotations: () => {
        set({ annotationHistory: initialHistory })
      },
      setPdfSession: (session) => {
        set({ pdfSession: session })
      },
      setBlankPage: (page) => {
        set({ blankPage: page })
      },
      setHasHydrated: (value) => {
        set({ hasHydrated: value })
      },
      clearPersistedSession: () => {
        set({
          annotationHistory: initialHistory,
          pdfSession: null,
          blankPage: null,
        })
      },
    }),
    {
      name: EDITOR_SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => createIdbStorage()),
      skipHydration: Boolean(import.meta.env.VITEST),
      partialize: (state) => ({
        annotationHistory: state.annotationHistory,
        pdfSession: state.pdfSession,
        blankPage: state.blankPage,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Failed to restore editor session', error)
        }
        useEditorSessionStore.setState({ hasHydrated: true })
      },
    },
  ),
)

export function cloneAnnotationHistory(
  history: AnnotationHistoryState,
): AnnotationHistoryState {
  return {
    past: history.past.map(cloneAnnotationRootState),
    present: cloneAnnotationRootState(history.present),
    future: history.future.map(cloneAnnotationRootState),
  }
}

export function resetEditorSessionStoreForTests(): void {
  useEditorSessionStore.setState({
    annotationHistory: initialHistory,
    pdfSession: null,
    blankPage: null,
    hasHydrated: true,
  })
}
