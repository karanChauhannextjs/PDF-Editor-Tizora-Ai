import {
  ArrowDown,
  ArrowUp,
  Circle,
  Minus,
  Square,
  Trash2,
  Type,
} from 'lucide-react'
import type { Annotation } from '@/types/annotation'
import { annotationKindLabel } from '@/utils/annotationGeometry'
import { Button } from '@/components/ui/button'

type AnnotationListPanelProps = {
  annotations: Annotation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (id: string, direction: 'forward' | 'backward') => void
  onDelete: (id: string) => void
}

export function AnnotationListPanel({
  annotations,
  selectedId,
  onSelect,
  onReorder,
  onDelete,
}: AnnotationListPanelProps) {
  const ordered = [...annotations].reverse()

  return (
    <aside
      className="flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border bg-background"
      aria-label="Annotation layers"
    >
      <div className="border-b px-3 py-2">
        <h2 className="text-sm font-medium">Layers</h2>
        <p className="text-xs text-muted-foreground">
          Top items draw above lower ones.
        </p>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {ordered.length === 0 ? (
          <li className="px-2 py-4 text-center text-xs text-muted-foreground">
            No annotations yet.
          </li>
        ) : (
          ordered.map((annotation, index) => {
            const layerNumber = ordered.length - index
            const isSelected = annotation.id === selectedId
            const canMoveUp = index > 0
            const canMoveDown = index < ordered.length - 1
            return (
              <li key={annotation.id} className="mb-1">
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-muted/70 ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-muted/40'
                  }`}
                  onClick={() => onSelect(annotation.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(annotation.id)
                    }
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
                    <LayerIcon annotation={annotation} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {layerNumber}. {annotationKindLabel(annotation)}
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {layerSummary(annotation)}
                      </span>
                    </span>
                  </div>
                  <div
                    className="flex shrink-0 items-center gap-0.5"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <div className="flex flex-col">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={!canMoveUp}
                        aria-label={`Move ${annotationKindLabel(annotation)} up`}
                        onClick={() => onReorder(annotation.id, 'forward')}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={!canMoveDown}
                        aria-label={`Move ${annotationKindLabel(annotation)} down`}
                        onClick={() => onReorder(annotation.id, 'backward')}
                      >
                        <ArrowDown />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${annotationKindLabel(annotation)}`}
                      onClick={() => onDelete(annotation.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </aside>
  )
}

function LayerIcon({ annotation }: { annotation: Annotation }) {
  const className = 'size-3.5 shrink-0 text-muted-foreground'
  switch (annotation.type) {
    case 'rectangle':
      return <Square className={className} />
    case 'circle':
      return <Circle className={className} />
    case 'line':
      return <Minus className={className} />
    case 'text':
      return <Type className={className} />
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
}

function layerSummary(annotation: Annotation): string {
  switch (annotation.type) {
    case 'text':
      return annotation.text.replaceAll('\n', ' ').slice(0, 40)
    case 'rectangle':
      return `${Math.round(annotation.width)}×${Math.round(annotation.height)}`
    case 'circle':
      return `r ${Math.round(annotation.radius)}`
    case 'line':
      return 'Line segment'
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
}
