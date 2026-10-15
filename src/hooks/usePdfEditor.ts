import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Annotation, AnnotationTool, Point, TextAnnotation } from '@/types/annotation'
import {
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TEXT_FORMAT,
  type TextFormat,
} from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import type {
  PendingAction,
  PdfEditorOptions,
  TextDraft,
} from '@/components/editor/pdfEditor/types'
import { isEditableKeyboardTarget } from '@/components/editor/pdfEditor/utils'
import { useAnnotations } from '@/hooks/useAnnotations'
import { usePdfDocument } from '@/hooks/usePdfDocument'
import { useEditorSessionStore } from '@/stores/editorSessionStore'
import { isTextAnnotation, scaleAnnotationsToPage } from '@/utils/annotationGeometry'
import { clampAnnotationToPage } from '@/utils/annotationTransform'
import {
  buildAnnotationDocumentFromRoot,
  downloadAnnotationDocument,
  parseAnnotationDocument,
} from '@/utils/annotationPersistence'
import { downloadAnnotatedPdf } from '@/utils/pdfExport'
import { pagesMatch } from '@/utils/coordinates'
import { validateJsonFile, validatePdfFile } from '@/utils/fileValidation'

export function usePdfEditor({ initialPage }: PdfEditorOptions = {}) {
  const pdf = usePdfDocument()
  const annotationPageIndex = pdf.page ? pdf.currentPageIndex : 1
  const annotationsApi = useAnnotations(annotationPageIndex)
  const {
    annotations,
    selectedId,
    dispatch,
    beginHistoryTransaction,
    endHistoryTransaction,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetAnnotations,
    replacePage,
    replaceDocument,
    setPageDimensions,
    exportRootState,
    totalAnnotationCount,
  } = annotationsApi

  const [tool, setTool] = useState<AnnotationTool | null>(null)
  const [blankPage, setBlankPage] = useState<PdfPageDimensions | null>(initialPage ?? null)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [appError, setAppError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [drawStroke, setDrawStroke] = useState(DEFAULT_STROKE)
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(DEFAULT_STROKE_WIDTH)
  const [textFormat, setTextFormat] = useState<TextFormat>(DEFAULT_TEXT_FORMAT)
  const [shapeColorPickerActive, setShapeColorPickerActive] = useState(false)
  const [pdfRestoreFailed, setPdfRestoreFailed] = useState(false)

  const hasHydrated = useEditorSessionStore((state) => state.hasHydrated)
  const pdfSession = useEditorSessionStore((state) => state.pdfSession)
  const storedBlankPage = useEditorSessionStore((state) => state.blankPage)
  const setPdfSession = useEditorSessionStore((state) => state.setPdfSession)
  const setStoredBlankPage = useEditorSessionStore((state) => state.setBlankPage)
  const clearPersistedSession = useEditorSessionStore((state) => state.clearPersistedSession)

  const sessionRestoredRef = useRef(false)
  const { loadFromBytes } = pdf

  const isRestoringPdf = pdfSession !== null && pdf.page === null && !pdfRestoreFailed

  const page = pdf.page ?? (pdfSession ? null : (blankPage ?? storedBlankPage))
  const activeTool: AnnotationTool | null = page ? (tool ?? 'select') : null
  const selected = annotations.find((annotation) => annotation.id === selectedId) ?? null
  const banner = appError ?? pdf.error

  useEffect(() => {
    if (!hasHydrated || sessionRestoredRef.current) {
      return
    }
    sessionRestoredRef.current = true
    const { pdfSession: storedSession } = useEditorSessionStore.getState()
    if (storedSession) {
      void loadFromBytes(
        new Uint8Array(storedSession.pdfData),
        storedSession.fileName,
        storedSession.currentPageIndex,
      ).then((result) => {
        if (!result.ok) {
          setPdfRestoreFailed(true)
          setAppError(result.message)
        }
      })
    }
  }, [hasHydrated, loadFromBytes])

  useEffect(() => {
    if (pdf.page) {
      setPageDimensions(pdf.currentPageIndex, pdf.page)
    }
  }, [pdf.page, pdf.currentPageIndex, setPageDimensions])

  const deleteAnnotation = useCallback(
    (id: string) => {
      dispatch({ type: 'delete', id })
      setTextDraft((draft) => (draft?.mode === 'edit' && draft.id === id ? null : draft))
    },
    [dispatch],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target) || textDraft) {
        return
      }
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return
      }
      if (!selectedId) {
        return
      }
      event.preventDefault()
      deleteAnnotation(selectedId)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteAnnotation, redo, selectedId, textDraft, undo])

  const handleToolChange = (nextTool: AnnotationTool) => {
    setTool(nextTool)
    if (nextTool !== 'text') {
      setTextDraft(null)
    }
  }

  const openPdf = async (file: File) => {
    const result = await pdf.loadFile(file)
    if (!result.ok) {
      setAppError(result.message)
      return
    }
    resetAnnotations()
    setBlankPage(null)
    setStoredBlankPage(null)
    setTextDraft(null)
    setAppError(null)
    pdf.clearError()
    setPdfRestoreFailed(false)
    const pdfBytes = pdf.getPdfBytes()
    if (pdfBytes) {
      setPdfSession({
        fileName: file.name,
        pdfData: Array.from(pdfBytes),
        currentPageIndex: 1,
      })
    }
  }

  const handleOpenPdf = (file: File) => {
    const validation = validatePdfFile(file)
    if (!validation.ok) {
      setAppError(validation.message)
      return
    }
    if (totalAnnotationCount > 0) {
      setPending({ kind: 'open-pdf', file })
      return
    }
    void openPdf(file)
  }

  const applyImport = (serialized: string) => {
    const parsed = parseAnnotationDocument(serialized)
    if (!parsed.ok) {
      setAppError(parsed.message)
      return
    }

    if (parsed.import.format === 'multi') {
      const pages: Record<number, Annotation[]> = {}
      const pageDimensions: Record<number, PdfPageDimensions> = {}
      let count = 0
      for (const [pageIndex, bundle] of Object.entries(parsed.import.pages)) {
        const index = Number(pageIndex)
        const target = pdf.currentPageIndex === index && pdf.page ? pdf.page : bundle.page
        const scaled = scaleAnnotationsToPage(bundle.annotations, bundle.page, target)
        pages[index] = scaled
        pageDimensions[index] = target
        count += scaled.length
      }
      replaceDocument(pages, pageDimensions)
      setTextDraft(null)
      setAppError(null)
      toast.success(
        `Imported ${count} annotation${count === 1 ? '' : 's'} across ${Object.keys(pages).length} page${Object.keys(pages).length === 1 ? '' : 's'}.`,
      )
      return
    }

    const target = pdf.page ?? parsed.import.page
    const scaled = scaleAnnotationsToPage(parsed.import.annotations, parsed.import.page, target)
    replacePage(annotationPageIndex, target, scaled)
    if (!pdf.page) {
      setBlankPage(parsed.import.page)
      setStoredBlankPage(parsed.import.page)
      setPdfSession(null)
    }
    setTextDraft(null)
    setAppError(null)
    const scaledNote = pagesMatch(parsed.import.page, target)
      ? ''
      : ' Coordinates were scaled to the current page.'
    const count = scaled.length
    toast.success(`Imported ${count} annotation${count === 1 ? '' : 's'}.${scaledNote}`)
  }

  const handleImportAnnotations = async (file: File) => {
    const validation = validateJsonFile(file)
    if (!validation.ok) {
      setAppError(validation.message)
      return
    }

    let serialized = ''
    try {
      serialized = await file.text()
    } catch (error) {
      console.error('Failed to read annotation file', error)
      setAppError('The annotation file could not be read.')
      return
    }

    if (totalAnnotationCount > 0) {
      setPending({ kind: 'import', documentJson: serialized })
      return
    }
    applyImport(serialized)
  }

  const handleDownloadPdf = () => {
    const pdfBytes = pdf.getPdfBytes()
    const fileName = pdf.fileName
    if (!pdfBytes || !fileName || !page) {
      setAppError(
        pdf.fileName && pdf.getPdfBytes() === null
          ? 'Re-open the PDF, then try downloading again.'
          : 'Open a PDF before downloading.',
      )
      return
    }
    if (totalAnnotationCount === 0) {
      setAppError('There are no annotations to include in the PDF.')
      return
    }
    setIsDownloadingPdf(true)
    void downloadAnnotatedPdf(pdfBytes, exportRootState(), fileName)
      .then(() => {
        setAppError(null)
        toast.success('Downloaded PDF with your annotations applied.')
      })
      .catch((error) => {
        console.error('Failed to export annotated PDF', error)
        setAppError('The annotated PDF could not be created.')
      })
      .finally(() => {
        setIsDownloadingPdf(false)
      })
  }

  const handleExportAnnotations = () => {
    if (!page || totalAnnotationCount === 0) {
      setAppError('There are no annotations to export.')
      return
    }
    try {
      const document = buildAnnotationDocumentFromRoot(exportRootState())
      if (document.pages.length === 0) {
        setAppError('There are no annotations to export.')
        return
      }
      downloadAnnotationDocument(document)
      setAppError(null)
      toast.success('Exported annotations as JSON. They are not embedded in the PDF.')
    } catch (error) {
      console.error('Failed to export annotations', error)
      setAppError('The annotation file could not be exported.')
    }
  }

  const confirmPending = () => {
    const action = pending
    setPending(null)
    if (!action) {
      return
    }
    if (action.kind === 'open-pdf') {
      void openPdf(action.file)
      return
    }
    applyImport(action.documentJson)
  }

  const handleTextRequest = (point: Point) => {
    setTextDraft({ mode: 'create', x: point.x, y: point.y })
  }

  const handleEditText = (annotation: Annotation) => {
    if (!isTextAnnotation(annotation)) {
      return
    }
    dispatch({ type: 'select', id: annotation.id })
    setTool('select')
    setTextDraft({
      mode: 'edit',
      id: annotation.id,
      x: annotation.x,
      y: annotation.y,
      text: annotation.text,
    })
  }

  const handleCommitText = (text: string) => {
    if (!textDraft || !page) {
      return
    }
    if (textDraft.mode === 'create') {
      const annotation: TextAnnotation = {
        id: crypto.randomUUID(),
        type: 'text',
        x: textDraft.x,
        y: textDraft.y,
        text,
        ...textFormat,
        rotation: 0,
      }
      dispatch({
        type: 'add',
        annotation: clampAnnotationToPage(annotation, page) as TextAnnotation,
      })
    } else {
      const existing = annotations.find((item) => item.id === textDraft.id)
      if (existing && isTextAnnotation(existing)) {
        dispatch({
          type: 'updateAnnotation',
          id: textDraft.id,
          annotation: clampAnnotationToPage({ ...existing, text }, page),
        })
      }
    }
    setTextDraft(null)
    setTool('select')
  }

  const handleDelete = () => {
    if (!selectedId) {
      return
    }
    deleteAnnotation(selectedId)
  }

  const handleResetAnnotations = () => {
    if (totalAnnotationCount === 0 && !canUndo && !canRedo) {
      return
    }
    resetAnnotations()
    setTextDraft(null)
    setAppError(null)
    toast.success('All annotations were removed. Undo history was cleared.')
  }

  const handleRemovePdf = () => {
    if (!page) {
      return
    }
    pdf.unloadPdf()
    resetAnnotations()
    clearPersistedSession()
    setBlankPage(null)
    setTextDraft(null)
    setTool(null)
    setAppError(null)
    toast.success('PDF and all annotations were removed.')
  }

  const handlePageChange = (nextPage: number) => {
    setTextDraft(null)
    void pdf.goToPage(nextPage).then((result) => {
      if (!result.ok) {
        setAppError(result.message)
        return
      }
      const pdfBytes = pdf.getPdfBytes()
      if (pdfBytes && pdf.fileName) {
        setPdfSession({
          fileName: pdf.fileName,
          pdfData: Array.from(pdfBytes),
          currentPageIndex: nextPage,
        })
      }
    })
  }

  const canResetAnnotations = page !== null && (totalAnnotationCount > 0 || canUndo || canRedo)
  const canRemovePdf = page !== null

  return {
    pdf,
    page,
    activeTool,
    selected,
    selectedId,
    banner,
    annotations,
    dispatch,
    beginHistoryTransaction,
    endHistoryTransaction,
    undo,
    redo,
    canUndo,
    canRedo,
    textDraft,
    setTextDraft,
    drawStroke,
    drawStrokeWidth,
    textFormat,
    setDrawStroke,
    setDrawStrokeWidth,
    setTextFormat,
    shapeColorPickerActive,
    setShapeColorPickerActive,
    hasHydrated,
    isRestoringPdf,
    pdfSession,
    pending,
    setPending,
    isDownloadingPdf,
    totalAnnotationCount,
    canResetAnnotations,
    canRemovePdf,
    setAppError,
    handleOpenPdf,
    handleImportAnnotations,
    handleExportAnnotations,
    handleDownloadPdf,
    handleResetAnnotations,
    handleRemovePdf,
    confirmPending,
    handleToolChange,
    handleDelete,
    handleTextRequest,
    handleEditText,
    handleCommitText,
    deleteAnnotation,
    handlePageChange,
  }
}
