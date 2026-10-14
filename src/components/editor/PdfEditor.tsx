import { FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type {
  Annotation,
  AnnotationTool,
  Point,
  TextAnnotation,
} from '@/types/annotation'
import {
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TEXT_FORMAT,
  type TextFormat,
} from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import { useAnnotations } from '@/hooks/useAnnotations'
import { usePdfDocument } from '@/hooks/usePdfDocument'
import {
  annotationKindLabel,
  isTextAnnotation,
  scaleAnnotationsToPage,
} from '@/utils/annotationGeometry'
import {
  buildAnnotationDocumentFromRoot,
  downloadAnnotationDocument,
  parseAnnotationDocument,
} from '@/utils/annotationPersistence'
import { downloadAnnotatedPdf } from '@/utils/pdfExport'
import { pagesMatch } from '@/utils/coordinates'
import { validateJsonFile, validatePdfFile } from '@/utils/fileValidation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AnnotationLayer } from '@/components/editor/AnnotationLayer'
import { AnnotationListPanel } from '@/components/editor/AnnotationListPanel'
import { AnnotationStyleBar } from '@/components/editor/AnnotationStyleBar'
import { AnnotationToolbar } from '@/components/editor/AnnotationToolbar'
import {
  acceptSelectedFile,
  FileControls,
  fileHeaderButtonClass,
} from '@/components/editor/FileControls'
import { cn } from '@/lib/utils'
import { PageControls } from '@/components/editor/PageControls'
import { PdfViewer } from '@/components/editor/PdfViewer'
import { TextAnnotationEditor } from '@/components/editor/TextAnnotationEditor'

type PdfEditorProps = {
  initialPage?: PdfPageDimensions
}

type TextDraft =
  | { mode: 'create'; x: number; y: number }
  | { mode: 'edit'; id: string; x: number; y: number; text: string }

type PendingAction =
  { kind: 'open-pdf'; file: File } | { kind: 'import'; documentJson: string }

export function PdfEditor({ initialPage }: PdfEditorProps) {
  const pdf = usePdfDocument()
  const annotationPageIndex = pdf.page ? pdf.currentPageIndex : 1
  const {
    annotations,
    selectedId,
    dispatch,
    beginHistoryTransaction,
    endHistoryTransaction,
    undo,
    redo,
    reset: resetAnnotations,
    replacePage,
    replaceDocument,
    setPageDimensions,
    exportRootState,
    totalAnnotationCount,
  } = useAnnotations(annotationPageIndex)
  const [tool, setTool] = useState<AnnotationTool | null>(null)
  const [blankPage, setBlankPage] = useState<PdfPageDimensions | null>(
    initialPage ?? null,
  )
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [appError, setAppError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [drawStroke, setDrawStroke] = useState(DEFAULT_STROKE)
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(DEFAULT_STROKE_WIDTH)
  const [textFormat, setTextFormat] = useState<TextFormat>(DEFAULT_TEXT_FORMAT)
  const [shapeColorPickerActive, setShapeColorPickerActive] = useState(false)

  const page = pdf.page ?? blankPage
  const activeTool: AnnotationTool | null = page ? (tool ?? 'select') : null
  const selected =
    annotations.find((annotation) => annotation.id === selectedId) ?? null
  const banner = appError ?? pdf.error

  useEffect(() => {
    if (pdf.page) {
      setPageDimensions(pdf.currentPageIndex, pdf.page)
    }
  }, [pdf.page, pdf.currentPageIndex, setPageDimensions])

  const deleteAnnotation = useCallback(
    (id: string) => {
      dispatch({ type: 'delete', id })
      setTextDraft((draft) =>
        draft?.mode === 'edit' && draft.id === id ? null : draft,
      )
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
    setTextDraft(null)
    setNotice(null)
    setAppError(null)
    pdf.clearError()
  }

  const handleOpenPdf = (file: File) => {
    const validation = validatePdfFile(file)
    if (!validation.ok) {
      setNotice(null)
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
      setNotice(null)
      setAppError(parsed.message)
      return
    }

    if (parsed.import.format === 'multi') {
      const pages: Record<number, Annotation[]> = {}
      const pageDimensions: Record<number, PdfPageDimensions> = {}
      let count = 0
      for (const [pageIndex, bundle] of Object.entries(parsed.import.pages)) {
        const index = Number(pageIndex)
        const target =
          pdf.currentPageIndex === index && pdf.page ? pdf.page : bundle.page
        const scaled = scaleAnnotationsToPage(
          bundle.annotations,
          bundle.page,
          target,
        )
        pages[index] = scaled
        pageDimensions[index] = target
        count += scaled.length
      }
      replaceDocument(pages, pageDimensions)
      setTextDraft(null)
      setAppError(null)
      setNotice(
        `Imported ${count} annotation${count === 1 ? '' : 's'} across ${Object.keys(pages).length} page${Object.keys(pages).length === 1 ? '' : 's'}.`,
      )
      return
    }

    const target = pdf.page ?? parsed.import.page
    const scaled = scaleAnnotationsToPage(
      parsed.import.annotations,
      parsed.import.page,
      target,
    )
    replacePage(annotationPageIndex, target, scaled)
    if (!pdf.page) {
      setBlankPage(parsed.import.page)
    }
    setTextDraft(null)
    setAppError(null)
    const scaledNote = pagesMatch(parsed.import.page, target)
      ? ''
      : ' Coordinates were scaled to the current page.'
    const count = scaled.length
    setNotice(
      `Imported ${count} annotation${count === 1 ? '' : 's'}.${scaledNote}`,
    )
  }

  const handleImportAnnotations = async (file: File) => {
    const validation = validateJsonFile(file)
    if (!validation.ok) {
      setNotice(null)
      setAppError(validation.message)
      return
    }

    let serialized = ''
    try {
      serialized = await file.text()
    } catch (error) {
      console.error('Failed to read annotation file', error)
      setNotice(null)
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
      setNotice(null)
      setAppError(
        pdf.fileName && pdf.getPdfBytes() === null
          ? 'Re-open the PDF, then try downloading again.'
          : 'Open a PDF before downloading.',
      )
      return
    }
    if (totalAnnotationCount === 0) {
      setNotice(null)
      setAppError('There are no annotations to include in the PDF.')
      return
    }
    setIsDownloadingPdf(true)
    void downloadAnnotatedPdf(pdfBytes, exportRootState(), fileName)
      .then(() => {
        setAppError(null)
        setNotice('Downloaded PDF with your annotations applied.')
      })
      .catch((error) => {
        console.error('Failed to export annotated PDF', error)
        setNotice(null)
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
      setNotice(
        'Exported annotations as JSON. They are not embedded in the PDF.',
      )
    } catch (error) {
      console.error('Failed to export annotations', error)
      setNotice(null)
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
    if (!textDraft) {
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
      dispatch({ type: 'add', annotation })
    } else {
      dispatch({ type: 'updateText', id: textDraft.id, text })
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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-muted/40">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">PDF Editor</h1>
          <p className="text-xs text-muted-foreground">
            Annotate a PDF page, export JSON, or download an annotated PDF.
          </p>
        </div>
        <FileControls
          canImport={pdf.page !== null}
          canExport={totalAnnotationCount > 0 && page !== null}
          canDownloadPdf={
            pdf.getPdfBytes() !== null &&
            totalAnnotationCount > 0 &&
            page !== null
          }
          isLoading={pdf.phase === 'loading'}
          isDownloadingPdf={isDownloadingPdf}
          onOpenPdf={handleOpenPdf}
          onImportAnnotations={(file) => {
            void handleImportAnnotations(file)
          }}
          onExportAnnotations={handleExportAnnotations}
          onDownloadPdf={handleDownloadPdf}
          onFileError={(message) => {
            setNotice(null)
            setAppError(message)
          }}
        />
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-4">
        <div className="flex shrink-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AnnotationToolbar
              tool={activeTool}
              canDraw={page !== null}
              canDelete={selectedId !== null}
              onToolChange={handleToolChange}
              onDelete={handleDelete}
            />
            <p className="text-sm text-muted-foreground">
              Active tool:{' '}
              <span className="font-medium text-foreground">
                {activeTool === null ? 'None' : toolLabel(activeTool)}
              </span>
            </p>
          </div>

          <AnnotationStyleBar
            tool={activeTool}
            selected={selected}
            isComposingText={textDraft !== null}
            drawStroke={drawStroke}
            drawStrokeWidth={drawStrokeWidth}
            textFormat={textFormat}
            onDrawStrokeChange={setDrawStroke}
            onDrawStrokeWidthChange={setDrawStrokeWidth}
            onTextFormatChange={setTextFormat}
            onUpdateSelectedStroke={(stroke) => {
              if (!selectedId) {
                return
              }
              dispatch({ type: 'updateStroke', id: selectedId, stroke })
            }}
            onUpdateSelectedStrokeWidth={(strokeWidth) => {
              if (!selectedId) {
                return
              }
              dispatch({
                type: 'updateStrokeWidth',
                id: selectedId,
                strokeWidth,
              })
            }}
            onUpdateSelectedTextFormat={(format) => {
              if (!selectedId) {
                return
              }
              dispatch({ type: 'updateTextFormat', id: selectedId, format })
            }}
            onShapeColorPickerActiveChange={setShapeColorPickerActive}
          />

          {banner ? (
            <Alert variant="destructive">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{banner}</AlertDescription>
            </Alert>
          ) : null}
          {notice ? (
            <Alert>
              <AlertTitle>Annotations</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}
          {page ? (
            <div
              className="flex min-h-8 flex-wrap items-center gap-3 text-sm"
              aria-live="polite"
            >
              {selected ? (
                <>
                  <span>
                    Selected {annotationKindLabel(selected)}. Drag it to move, or
                    press Delete to remove it.
                  </span>
                  {isTextAnnotation(selected) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditText(selected)}
                    >
                      Edit text
                    </Button>
                  ) : null}
                </>
              ) : (
                <span className="invisible select-none" aria-hidden="true">
                  No annotation selected.
                </span>
              )}
            </div>
          ) : null}
        </div>

        <section className="mt-4 flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div
            className={cn(
              'min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border bg-muted/60 p-4',
              !page && 'flex flex-col',
            )}
          >
            {pdf.phase === 'loading' ? (
              <p className="mb-3 text-sm text-muted-foreground">Loading PDF…</p>
            ) : null}
            {page ? (
              <>
                <PageControls
                  currentPage={pdf.currentPageIndex}
                  pageCount={pdf.pageCount}
                  disabled={pdf.phase === 'loading'}
                  onPageChange={(nextPage) => {
                    setTextDraft(null)
                    void pdf.goToPage(nextPage).then((result) => {
                      if (!result.ok) {
                        setAppError(result.message)
                      }
                    })
                  }}
                />
                <PdfViewer
                  page={page}
                  showCanvas={pdf.page !== null}
                  fileName={pdf.fileName}
                  pageCount={pdf.pageCount}
                  currentPageIndex={pdf.currentPageIndex}
                  canvasRef={pdf.handleCanvasRef}
                >
                  <AnnotationLayer
                    page={page}
                    tool={activeTool}
                    drawStroke={drawStroke}
                    drawStrokeWidth={drawStrokeWidth}
                    annotations={annotations}
                    selectedId={selectedId}
                    editingTextId={
                      textDraft?.mode === 'edit' ? textDraft.id : null
                    }
                    hideSelectionChrome={shapeColorPickerActive}
                    dispatch={dispatch}
                    onTextRequest={handleTextRequest}
                    onEditText={handleEditText}
                    onBeginHistoryTransaction={beginHistoryTransaction}
                    onEndHistoryTransaction={endHistoryTransaction}
                  />
                  {textDraft ? (
                    <TextAnnotationEditor
                      page={page}
                      x={textDraft.x}
                      y={textDraft.y}
                      initialText={
                        textDraft.mode === 'edit' ? textDraft.text : ''
                      }
                      onCommit={handleCommitText}
                      onCancel={() => setTextDraft(null)}
                    />
                  ) : null}
                </PdfViewer>
              </>
            ) : (
              <EmptyState
                isLoading={pdf.phase === 'loading'}
                onOpenPdf={handleOpenPdf}
                onFileError={(message) => {
                  setNotice(null)
                  setAppError(message)
                }}
              />
            )}
          </div>
          {annotations.length > 0 ? (
            <AnnotationListPanel
              annotations={annotations}
              selectedId={selectedId}
              onSelect={(id) => dispatch({ type: 'select', id })}
              onReorder={(id, direction) =>
                dispatch({ type: 'reorder', id, direction })
              }
              onDelete={deleteAnnotation}
            />
          ) : null}
        </section>
      </main>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === 'import'
                ? 'Replace annotations?'
                : 'Open a different PDF?'}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === 'import'
                ? 'Importing replaces every annotation in this document.'
                : 'If the PDF opens, all annotations are cleared. Export them first if you want to keep them.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmPending}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const NO_PDF_IMAGE = `${import.meta.env.BASE_URL}no-data.png`

type EmptyStateProps = {
  isLoading: boolean
  onOpenPdf: (file: File) => void
  onFileError: (message: string) => void
}

function EmptyState({ isLoading, onOpenPdf, onFileError }: EmptyStateProps) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center"
      role="status"
      aria-live="polite"
    >
      <img
        src={NO_PDF_IMAGE}
        alt=""
        width={60}
        height={60}
        className="h-15 w-15 object-contain"
        decoding="async"
      />
      <div className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          No PDF selected
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Upload a document to view pages and add shapes and text notes. You can
          export annotations as JSON or download an annotated PDF when you are
          done.
        </p>
        <label
          className={cn(
            buttonVariants({ variant: 'default', size: 'sm' }),
            fileHeaderButtonClass,
            'mx-auto mt-1',
            isLoading && 'pointer-events-none opacity-50',
          )}
        >
          <FolderOpen />
          Open PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={isLoading}
            aria-label="Open PDF"
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0]
              if (!selected) {
                return
              }
              void acceptSelectedFile(
                event.currentTarget,
                selected,
                onOpenPdf,
                onFileError,
              )
            }}
          />
        </label>
      </div>
    </div>
  )
}

function toolLabel(tool: AnnotationTool): string {
  switch (tool) {
    case 'select':
      return 'Select'
    case 'rectangle':
      return 'Rectangle'
    case 'circle':
      return 'Circle'
    case 'line':
      return 'Line'
    case 'text':
      return 'Text'
    default: {
      const unreachable: never = tool
      return unreachable
    }
  }
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
