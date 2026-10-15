import type { ReactNode } from 'react'
import { Circle, Minus, MousePointer2, Redo2, Square, Trash2, Type, Undo2 } from 'lucide-react'
import type { AnnotationTool } from '@/types/annotation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type AnnotationToolbarProps = {
  tool: AnnotationTool | null
  canDraw: boolean
  canUndo: boolean
  canRedo: boolean
  canDelete: boolean
  onToolChange: (tool: AnnotationTool) => void
  onUndo: () => void
  onRedo: () => void
  onDelete: () => void
}

function AnnotationToolbar({
  tool,
  canDraw,
  canUndo,
  canRedo,
  canDelete,
  onToolChange,
  onUndo,
  onRedo,
  onDelete,
}: AnnotationToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2',
        'max-md:flex-nowrap max-md:overflow-x-auto max-md:scroll-px-4 max-md:pe-4 max-md:pb-1 max-md:[-webkit-overflow-scrolling:touch] max-md:[&>*]:shrink-0',
        'md:flex-wrap',
      )}
      role="toolbar"
      aria-label="Annotation tools"
    >
      <HistoryIconButton label="Undo" hint="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="size-4" />
      </HistoryIconButton>
      <HistoryIconButton
        label="Redo"
        hint="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Redo2 className="size-4" />
      </HistoryIconButton>
      <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
      <ToolButton
        label="Select"
        pressed={tool === 'select'}
        disabled={!canDraw}
        onClick={() => onToolChange('select')}
      >
        <MousePointer2 />
        Select
      </ToolButton>
      <ToolButton
        label="Rectangle"
        pressed={tool === 'rectangle'}
        disabled={!canDraw}
        onClick={() => onToolChange('rectangle')}
      >
        <Square />
        Rectangle
      </ToolButton>
      <ToolButton
        label="Circle"
        pressed={tool === 'circle'}
        disabled={!canDraw}
        onClick={() => onToolChange('circle')}
      >
        <Circle />
        Circle
      </ToolButton>
      <ToolButton
        label="Line"
        pressed={tool === 'line'}
        disabled={!canDraw}
        onClick={() => onToolChange('line')}
      >
        <Minus />
        Line
      </ToolButton>
      <ToolButton
        label="Text"
        pressed={tool === 'text'}
        disabled={!canDraw}
        onClick={() => onToolChange('text')}
      >
        <Type />
        Text
      </ToolButton>
      <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={toolButtonClass(false)}
              disabled={!canDelete}
              aria-label="Delete selected annotation"
              onClick={onDelete}
            />
          }
        >
          <Trash2 />
          Delete
        </TooltipTrigger>
        <TooltipContent>Delete the selected annotation</TooltipContent>
      </Tooltip>
    </div>
  )
}

function HistoryIconButton({
  label,
  hint,
  disabled,
  onClick,
  children,
}: {
  label: string
  hint: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="size-9 rounded-xl border-border bg-background text-foreground hover:bg-muted/70"
            disabled={disabled}
            aria-label={label}
            onClick={onClick}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  pressed: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? 'default' : 'outline'}
      className={toolButtonClass(pressed)}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function toolButtonClass(pressed: boolean) {
  return cn(
    'h-9 gap-2 rounded-xl px-3 text-sm [&_svg]:text-current',
    !pressed && 'border-border bg-background text-foreground hover:bg-muted/70',
  )
}

export { AnnotationToolbar }
