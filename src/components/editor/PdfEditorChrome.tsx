import type { Annotation, AnnotationTool, TextFormat } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import { annotationKindLabel, isTextAnnotation } from '@/utils/annotationGeometry'
import type { AnnotationAction } from '@/utils/annotationReducer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AnnotationStyleBar } from '@/components/editor/AnnotationStyleBar'
import { AnnotationToolbar } from '@/components/editor/AnnotationToolbar'
import { toolLabel } from '@/components/editor/pdfEditor/utils'

type PdfEditorChromeProps = {
  page: PdfPageDimensions | null
  activeTool: AnnotationTool | null
  selected: Annotation | null
  selectedId: string | null
  textDraftActive: boolean
  banner: string | null
  drawStroke: string
  drawStrokeWidth: number
  textFormat: TextFormat
  canUndo: boolean
  canRedo: boolean
  onDrawStrokeChange: (stroke: string) => void
  onDrawStrokeWidthChange: (strokeWidth: number) => void
  onTextFormatChange: (format: TextFormat) => void
  onToolChange: (tool: AnnotationTool) => void
  onUndo: () => void
  onRedo: () => void
  onDelete: () => void
  onEditText: (annotation: Annotation) => void
  dispatch: (action: AnnotationAction) => void
  onShapeColorPickerActiveChange: (active: boolean) => void
  onBeginStyleHistoryTransaction: () => void
  onEndStyleHistoryTransaction: () => void
}

export function PdfEditorChrome({
  page,
  activeTool,
  selected,
  selectedId,
  textDraftActive,
  banner,
  drawStroke,
  drawStrokeWidth,
  textFormat,
  canUndo,
  canRedo,
  onDrawStrokeChange,
  onDrawStrokeWidthChange,
  onTextFormatChange,
  onToolChange,
  onUndo,
  onRedo,
  onDelete,
  onEditText,
  dispatch,
  onShapeColorPickerActiveChange,
  onBeginStyleHistoryTransaction,
  onEndStyleHistoryTransaction,
}: PdfEditorChromeProps) {
  return (
    <div className="flex shrink-0 flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3">
        <div className="min-w-0 max-md:-mx-4 max-md:px-4">
          <AnnotationToolbar
            tool={activeTool}
            canDraw={page !== null}
            canUndo={canUndo}
            canRedo={canRedo}
            canDelete={selectedId !== null}
            onToolChange={onToolChange}
            onUndo={onUndo}
            onRedo={onRedo}
            onDelete={onDelete}
          />
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">
          Active tool:{' '}
          <span className="font-medium text-foreground">
            {activeTool === null ? 'None' : toolLabel(activeTool)}
          </span>
        </p>
      </div>

      <div className="min-w-0 max-md:-mx-4 max-md:px-4">
        <AnnotationStyleBar
          tool={activeTool}
          selected={selected}
          isComposingText={textDraftActive}
          drawStroke={drawStroke}
          drawStrokeWidth={drawStrokeWidth}
          textFormat={textFormat}
          onDrawStrokeChange={onDrawStrokeChange}
          onDrawStrokeWidthChange={onDrawStrokeWidthChange}
          onTextFormatChange={onTextFormatChange}
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
          onShapeColorPickerActiveChange={onShapeColorPickerActiveChange}
          onBeginStyleHistoryTransaction={onBeginStyleHistoryTransaction}
          onEndStyleHistoryTransaction={onEndStyleHistoryTransaction}
        />
      </div>

      {banner ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      ) : null}

      {page ? (
        <div className="flex min-h-8 flex-wrap items-center gap-3 text-sm" aria-live="polite">
          {selected ? (
            <>
              <span>
                Selected {annotationKindLabel(selected)}. Drag it to move, or press Delete to remove
                it.
              </span>
              {isTextAnnotation(selected) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onEditText(selected)}
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
  )
}
