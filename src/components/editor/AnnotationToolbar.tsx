import type { ReactNode } from 'react'
import {
  Circle,
  Minus,
  MousePointer2,
  Square,
  Trash2,
  Type,
} from 'lucide-react'
import type { AnnotationTool } from '@/types/annotation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type AnnotationToolbarProps = {
  tool: AnnotationTool | null
  canDraw: boolean
  canDelete: boolean
  onToolChange: (tool: AnnotationTool) => void
  onDelete: () => void
}

export function AnnotationToolbar({
  tool,
  canDraw,
  canDelete,
  onToolChange,
  onDelete,
}: AnnotationToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="toolbar"
      aria-label="Annotation tools"
    >
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
    !pressed &&
      'border-border bg-background text-foreground hover:bg-muted/70',
  )
}
