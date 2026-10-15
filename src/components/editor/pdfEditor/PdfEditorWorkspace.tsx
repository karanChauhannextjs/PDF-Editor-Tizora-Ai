import type { Annotation, AnnotationTool } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import type { usePdfDocument } from '@/hooks/usePdfDocument'
import type { AnnotationAction } from '@/utils/annotationReducer'
import { AnnotationLayer } from '@/components/editor/annotation/AnnotationLayer'
import { AnnotationListPanel } from '@/components/editor/annotation/AnnotationListPanel'
import { TextAnnotationEditor } from '@/components/editor/annotation/TextAnnotationEditor'
import { PageControls } from '@/components/editor/PageControls'
import { PdfEditorEmptyState } from '@/components/editor/pdfEditor/PdfEditorEmptyState'
import type { TextDraft } from '@/components/editor/pdfEditor/types'
import { PdfViewer } from '@/components/editor/PdfViewer'
import { SessionLoader } from '@/components/editor/SessionLoader'
import { cn } from '@/lib/utils'

type PdfEditorWorkspaceProps = {
  pdf: ReturnType<typeof usePdfDocument>
  page: PdfPageDimensions | null
  activeTool: AnnotationTool | null
  drawStroke: string
  drawStrokeWidth: number
  annotations: Annotation[]
  selectedId: string | null
  textDraft: TextDraft | null
  shapeColorPickerActive: boolean
  dispatch: (action: AnnotationAction) => void
  onPageChange: (page: number) => void
  onOpenPdf: (file: File) => void
  onFileError: (message: string) => void
  onTextRequest: (point: { x: number; y: number }) => void
  onEditText: (annotation: Annotation) => void
  onCommitText: (text: string) => void
  onCancelText: () => void
  onBeginHistoryTransaction: () => void
  onEndHistoryTransaction: () => void
  onSelectAnnotation: (id: string) => void
  onReorderAnnotation: (id: string, direction: 'forward' | 'backward') => void
  onDeleteAnnotation: (id: string) => void
}

export function PdfEditorWorkspace({
  pdf,
  page,
  activeTool,
  drawStroke,
  drawStrokeWidth,
  annotations,
  selectedId,
  textDraft,
  shapeColorPickerActive,
  dispatch,
  onPageChange,
  onOpenPdf,
  onFileError,
  onTextRequest,
  onEditText,
  onCommitText,
  onCancelText,
  onBeginHistoryTransaction,
  onEndHistoryTransaction,
  onSelectAnnotation,
  onReorderAnnotation,
  onDeleteAnnotation,
}: PdfEditorWorkspaceProps) {
  return (
    <section className="mt-4 flex min-h-0 flex-1 flex-col gap-3 max-md:flex-none max-md:overflow-visible md:min-h-0 md:flex-row md:overflow-hidden">
      <div
        className={cn(
          'flex min-w-0 flex-col overflow-x-hidden rounded-xl border bg-muted/60 p-4',
          page &&
            'max-md:min-h-[76dvh] max-md:shrink-0 max-md:overflow-y-auto max-md:overscroll-contain max-md:[-webkit-overflow-scrolling:touch]',
          'md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain',
          !page && 'flex flex-col',
        )}
      >
        {page ? (
          <>
            <PageControls
              currentPage={pdf.currentPageIndex}
              pageCount={pdf.pageCount}
              disabled={pdf.phase === 'loading'}
              onPageChange={onPageChange}
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
                editingTextId={textDraft?.mode === 'edit' ? textDraft.id : null}
                hideSelectionChrome={shapeColorPickerActive}
                dispatch={dispatch}
                onTextRequest={onTextRequest}
                onEditText={onEditText}
                onBeginHistoryTransaction={onBeginHistoryTransaction}
                onEndHistoryTransaction={onEndHistoryTransaction}
              />
              {textDraft ? (
                <TextAnnotationEditor
                  page={page}
                  x={textDraft.x}
                  y={textDraft.y}
                  initialText={textDraft.mode === 'edit' ? textDraft.text : ''}
                  onCommit={onCommitText}
                  onCancel={onCancelText}
                />
              ) : null}
            </PdfViewer>
          </>
        ) : pdf.phase === 'loading' ? (
          <SessionLoader fullScreen={false} title="Loading PDF…" subtitle={pdf.fileName} />
        ) : (
          <PdfEditorEmptyState isLoading={false} onOpenPdf={onOpenPdf} onFileError={onFileError} />
        )}
      </div>
      {annotations.length > 0 ? (
        <AnnotationListPanel
          annotations={annotations}
          selectedId={selectedId}
          onSelect={onSelectAnnotation}
          onReorder={onReorderAnnotation}
          onDelete={onDeleteAnnotation}
        />
      ) : null}
    </section>
  )
}
