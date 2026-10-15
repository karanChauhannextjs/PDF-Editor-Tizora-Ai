import type { PdfPageDimensions } from '@/types/pdf'
import { usePdfEditor } from '@/hooks/usePdfEditor'
import { PdfEditorChrome } from '@/components/editor/PdfEditorChrome'
import { PdfEditorHeader } from '@/components/editor/PdfEditorHeader'
import { PdfEditorPendingDialog } from '@/components/editor/PdfEditorPendingDialog'
import { PdfEditorWorkspace } from '@/components/editor/PdfEditorWorkspace'
import { SessionLoader } from '@/components/editor/SessionLoader'

type PdfEditorProps = {
  initialPage?: PdfPageDimensions
}

export function PdfEditor({ initialPage }: PdfEditorProps) {
  const editor = usePdfEditor({ initialPage })

  if (!editor.hasHydrated) {
    return <SessionLoader title="Restoring your session…" />
  }

  if (editor.isRestoringPdf) {
    return <SessionLoader title="Opening your PDF…" subtitle={editor.pdfSession?.fileName} />
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-muted/40">
      <PdfEditorHeader
        canImport={editor.pdf.page !== null}
        canExport={editor.totalAnnotationCount > 0 && editor.page !== null}
        canDownloadPdf={
          editor.pdf.getPdfBytes() !== null &&
          editor.totalAnnotationCount > 0 &&
          editor.page !== null
        }
        isLoading={editor.pdf.phase === 'loading'}
        isDownloadingPdf={editor.isDownloadingPdf}
        onOpenPdf={editor.handleOpenPdf}
        onImportAnnotations={(file) => {
          void editor.handleImportAnnotations(file)
        }}
        onExportAnnotations={editor.handleExportAnnotations}
        onDownloadPdf={editor.handleDownloadPdf}
        canResetAnnotations={editor.canResetAnnotations}
        onResetAnnotations={editor.handleResetAnnotations}
        canRemovePdf={editor.canRemovePdf}
        onRemovePdf={editor.handleRemovePdf}
        onFileError={editor.setAppError}
      />

      <main
        className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 py-4 max-md:px-0 max-md:py-0"
      >
        <div
          className="shrink-0 max-md:border-b max-md:border-border/60 max-md:bg-muted/40 max-md:px-4 max-md:pt-2 max-md:pb-3"
        >
          <PdfEditorChrome
            page={editor.page}
            activeTool={editor.activeTool}
            selected={editor.selected}
            selectedId={editor.selectedId}
            textDraftActive={editor.textDraft !== null}
            banner={editor.banner}
            drawStroke={editor.drawStroke}
            drawStrokeWidth={editor.drawStrokeWidth}
            textFormat={editor.textFormat}
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            onDrawStrokeChange={editor.setDrawStroke}
            onDrawStrokeWidthChange={editor.setDrawStrokeWidth}
            onTextFormatChange={editor.setTextFormat}
            onToolChange={editor.handleToolChange}
            onUndo={editor.undo}
            onRedo={editor.redo}
            onDelete={editor.handleDelete}
            onEditText={editor.handleEditText}
            dispatch={editor.dispatch}
            onShapeColorPickerActiveChange={editor.setShapeColorPickerActive}
            onBeginStyleHistoryTransaction={editor.beginHistoryTransaction}
            onEndStyleHistoryTransaction={editor.endHistoryTransaction}
          />
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto max-md:px-4 max-md:pb-4 max-md:pt-2 max-md:overscroll-y-contain max-md:[-webkit-overflow-scrolling:touch] md:overflow-hidden md:flex md:flex-col md:pt-4"
        >
          <PdfEditorWorkspace
          pdf={editor.pdf}
          page={editor.page}
          activeTool={editor.activeTool}
          drawStroke={editor.drawStroke}
          drawStrokeWidth={editor.drawStrokeWidth}
          annotations={editor.annotations}
          selectedId={editor.selectedId}
          textDraft={editor.textDraft}
          shapeColorPickerActive={editor.shapeColorPickerActive}
          dispatch={editor.dispatch}
          onPageChange={editor.handlePageChange}
          onOpenPdf={editor.handleOpenPdf}
          onFileError={editor.setAppError}
          onTextRequest={editor.handleTextRequest}
          onEditText={editor.handleEditText}
          onCommitText={editor.handleCommitText}
          onCancelText={() => editor.setTextDraft(null)}
          onBeginHistoryTransaction={editor.beginHistoryTransaction}
          onEndHistoryTransaction={editor.endHistoryTransaction}
          onSelectAnnotation={(id) => editor.dispatch({ type: 'select', id })}
          onReorderAnnotation={(id, direction) =>
            editor.dispatch({ type: 'reorder', id, direction })
          }
          onDeleteAnnotation={editor.deleteAnnotation}
          />
        </div>
      </main>

      <PdfEditorPendingDialog
        pending={editor.pending}
        onClose={() => editor.setPending(null)}
        onConfirm={editor.confirmPending}
      />
    </div>
  )
}
