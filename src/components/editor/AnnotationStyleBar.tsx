import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bold, Italic, Underline } from 'lucide-react'
import type { Annotation, AnnotationTool, TextFormat } from '@/types/annotation'
import { DEFAULT_STROKE } from '@/types/annotation'
import {
  FONT_SIZE_OPTIONS,
  STROKE_WIDTH_OPTIONS,
  isShapeAnnotation,
  normalizeHexColor,
  textFormatFromAnnotation,
} from '@/utils/annotationStyle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/** Base UI select items use string values; parse safely for numeric stroke/font sizes. */
function parseSelectNumber(value: string | null): number | null {
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

type AnnotationStyleBarProps = {
  tool: AnnotationTool | null
  selected: Annotation | null
  isComposingText: boolean
  drawStroke: string
  drawStrokeWidth: number
  textFormat: TextFormat
  onDrawStrokeChange: (stroke: string) => void
  onDrawStrokeWidthChange: (strokeWidth: number) => void
  onTextFormatChange: (format: TextFormat) => void
  onUpdateSelectedStroke: (stroke: string) => void
  onUpdateSelectedStrokeWidth: (strokeWidth: number) => void
  onUpdateSelectedTextFormat: (format: Partial<TextFormat>) => void
  onShapeColorPickerActiveChange?: (active: boolean) => void
  onBeginStyleHistoryTransaction?: () => void
  onEndStyleHistoryTransaction?: () => void
}

export function AnnotationStyleBar({
  tool,
  selected,
  isComposingText,
  drawStroke,
  drawStrokeWidth,
  textFormat,
  onDrawStrokeChange,
  onDrawStrokeWidthChange,
  onTextFormatChange,
  onUpdateSelectedStroke,
  onUpdateSelectedStrokeWidth,
  onUpdateSelectedTextFormat,
  onShapeColorPickerActiveChange,
  onBeginStyleHistoryTransaction,
  onEndStyleHistoryTransaction,
}: AnnotationStyleBarProps) {
  const showTextControls =
    tool === 'text' || isComposingText || (tool === 'select' && selected?.type === 'text')
  const showShapeControls =
    tool === 'rectangle' ||
    tool === 'circle' ||
    tool === 'line' ||
    (tool === 'select' && !isComposingText && selected?.type !== 'text')

  const canEditShapeStyle =
    tool === 'rectangle' ||
    tool === 'circle' ||
    tool === 'line' ||
    (selected !== null && isShapeAnnotation(selected))

  const canEditTextStyle = tool === 'text' || isComposingText || selected?.type === 'text'

  const shapeStroke = selected && isShapeAnnotation(selected) ? selected.stroke : drawStroke
  const shapeStrokeWidth =
    selected && isShapeAnnotation(selected) ? selected.strokeWidth : drawStrokeWidth
  const activeText = textFormatFromAnnotation(selected?.type === 'text' ? selected : textFormat)

  const setShapeStroke = (stroke: string) => {
    if (selected && isShapeAnnotation(selected)) {
      onUpdateSelectedStroke(stroke)
      return
    }
    onDrawStrokeChange(stroke)
  }

  const setShapeStrokeWidth = (strokeWidth: number) => {
    if (selected && isShapeAnnotation(selected)) {
      onUpdateSelectedStrokeWidth(strokeWidth)
      return
    }
    onDrawStrokeWidthChange(strokeWidth)
  }

  const patchTextFormat = (patch: Partial<TextFormat>) => {
    if (selected?.type === 'text') {
      onUpdateSelectedTextFormat(patch)
      return
    }
    onTextFormatChange({ ...textFormat, ...patch })
  }

  if (!showShapeControls && !showTextControls) {
    return null
  }

  return (
    <div
      className={cn(
        'flex min-h-[3.25rem] items-center gap-3 rounded-lg border bg-background/80 px-3 py-2',
        'max-md:flex-nowrap max-md:overflow-x-auto max-md:scroll-px-4 max-md:pe-4 max-md:pb-1 max-md:[-webkit-overflow-scrolling:touch] max-md:[&>*]:shrink-0',
        'md:flex-wrap',
      )}
      role="group"
      aria-label="Annotation style"
    >
      {showShapeControls ? (
        <ColorPickerField
          label="Shape color"
          disabled={!canEditShapeStyle}
          instanceKey={
            selected && isShapeAnnotation(selected) ? `shape-${selected.id}` : 'shape-draw'
          }
          value={shapeStroke}
          onChange={setShapeStroke}
          onPickerActiveChange={onShapeColorPickerActiveChange}
          onBeginHistoryTransaction={onBeginStyleHistoryTransaction}
          onEndHistoryTransaction={onEndStyleHistoryTransaction}
        />
      ) : null}

      {showShapeControls ? (
        <StrokeWidthSelect
          disabled={!canEditShapeStyle}
          value={shapeStrokeWidth}
          onChange={setShapeStrokeWidth}
        />
      ) : null}

      {showShapeControls && showTextControls ? (
        <Separator orientation="vertical" className="mx-1 hidden h-8 sm:block" />
      ) : null}

      {showTextControls ? (
        <>
          <ColorPickerField
            label="Text color"
            disabled={!canEditTextStyle}
            instanceKey={selected?.type === 'text' ? `text-${selected.id}` : 'text-compose'}
            value={activeText.color}
            onChange={(color) => patchTextFormat({ color })}
            onBeginHistoryTransaction={onBeginStyleHistoryTransaction}
            onEndHistoryTransaction={onEndStyleHistoryTransaction}
          />
          <FontSizeSelect
            disabled={!canEditTextStyle}
            value={activeText.fontSize}
            onChange={(fontSize) => patchTextFormat({ fontSize })}
          />
          <ToggleFormat
            label="Bold"
            disabled={!canEditTextStyle}
            pressed={activeText.bold}
            onClick={() => patchTextFormat({ bold: !activeText.bold })}
          >
            <Bold className="size-4" />
          </ToggleFormat>
          <ToggleFormat
            label="Italic"
            disabled={!canEditTextStyle}
            pressed={activeText.italic}
            onClick={() => patchTextFormat({ italic: !activeText.italic })}
          >
            <Italic className="size-4" />
          </ToggleFormat>
          <ToggleFormat
            label="Underline"
            disabled={!canEditTextStyle}
            pressed={activeText.underline}
            onClick={() => patchTextFormat({ underline: !activeText.underline })}
          >
            <Underline className="size-4" />
          </ToggleFormat>
        </>
      ) : null}
    </div>
  )
}

function ColorPickerField({
  label,
  instanceKey,
  value,
  onChange,
  disabled = false,
  onPickerActiveChange,
  onBeginHistoryTransaction,
  onEndHistoryTransaction,
}: {
  label: string
  instanceKey: string
  value: string
  onChange: (color: string) => void
  disabled?: boolean
  onPickerActiveChange?: (active: boolean) => void
  onBeginHistoryTransaction?: () => void
  onEndHistoryTransaction?: () => void
}) {
  const safeValue = normalizeHexColor(value) ?? DEFAULT_STROKE
  return (
    <ColorPickerFieldInner
      key={instanceKey}
      label={label}
      safeValue={safeValue}
      disabled={disabled}
      onChange={onChange}
      onPickerActiveChange={onPickerActiveChange}
      onBeginHistoryTransaction={onBeginHistoryTransaction}
      onEndHistoryTransaction={onEndHistoryTransaction}
    />
  )
}

function ColorPickerFieldInner({
  label,
  safeValue,
  onChange,
  disabled = false,
  onPickerActiveChange,
  onBeginHistoryTransaction,
  onEndHistoryTransaction,
}: {
  label: string
  safeValue: string
  onChange: (color: string) => void
  disabled?: boolean
  onPickerActiveChange?: (active: boolean) => void
  onBeginHistoryTransaction?: () => void
  onEndHistoryTransaction?: () => void
}) {
  const [hexInput, setHexInput] = useState(safeValue)
  const fieldRef = useRef<HTMLDivElement>(null)
  const blurTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current)
      }
      onEndHistoryTransaction?.()
    }
  }, [onEndHistoryTransaction])

  useEffect(() => {
    if (fieldRef.current?.contains(document.activeElement)) {
      return
    }
    // Keep hex input aligned with undo/redo without remounting the color picker.
    setHexInput(safeValue)
  }, [safeValue])

  const setPickerActive = (active: boolean) => {
    onPickerActiveChange?.(active)
  }

  const cancelPickerInactive = () => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current)
      blurTimerRef.current = null
    }
  }

  const schedulePickerInactive = () => {
    cancelPickerInactive()
    blurTimerRef.current = window.setTimeout(() => {
      blurTimerRef.current = null
      if (fieldRef.current?.contains(document.activeElement)) {
        return
      }
      setPickerActive(false)
    }, 200)
  }

  useEffect(() => {
    if (!disabled) {
      return
    }
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current)
      blurTimerRef.current = null
    }
    onPickerActiveChange?.(false)
  }, [disabled, onPickerActiveChange])

  const endStyleHistory = () => {
    onEndHistoryTransaction?.()
  }

  const commitHex = () => {
    const normalized = normalizeHexColor(hexInput)
    if (normalized) {
      onChange(normalized)
      setHexInput(normalized)
    } else {
      setHexInput(safeValue)
    }
    endStyleHistory()
  }

  return (
    <div
      ref={fieldRef}
      className={cn(
        'flex flex-wrap items-center gap-2',
        disabled && 'pointer-events-none opacity-50',
      )}
      onFocusCapture={() => {
        if (disabled) {
          return
        }
        onBeginHistoryTransaction?.()
        cancelPickerInactive()
        setPickerActive(true)
      }}
      onBlurCapture={(event) => {
        if (disabled) {
          return
        }
        const next = event.relatedTarget as Node | null
        if (next && fieldRef.current?.contains(next)) {
          return
        }
        if (
          event.target instanceof HTMLInputElement &&
          event.target.type === 'color' &&
          next === null
        ) {
          return
        }
        endStyleHistory()
        schedulePickerInactive()
      }}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="color"
        disabled={disabled}
        className="h-9 w-11 cursor-pointer rounded-md border bg-background p-0.5 disabled:cursor-not-allowed"
        value={safeValue}
        onPointerDown={() => {
          cancelPickerInactive()
          setPickerActive(true)
        }}
        onFocus={() => {
          cancelPickerInactive()
          setPickerActive(true)
        }}
        onChange={(event) => {
          cancelPickerInactive()
          setPickerActive(true)
          onChange(event.target.value)
          setHexInput(event.target.value)
        }}
        onBlur={(event) => {
          if (event.relatedTarget === null) {
            schedulePickerInactive()
            return
          }
          endStyleHistory()
          schedulePickerInactive()
        }}
        aria-label={`${label} picker`}
      />
      <Input
        disabled={disabled}
        className="h-8 w-[6.5rem] font-mono text-xs"
        value={hexInput}
        onChange={(event) => {
          setPickerActive(true)
          setHexInput(event.target.value)
        }}
        onBlur={commitHex}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commitHex()
          }
        }}
        aria-label={`${label} hex value`}
        spellCheck={false}
      />
    </div>
  )
}

function StrokeWidthSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: number
  onChange: (strokeWidth: number) => void
  disabled?: boolean
}) {
  const widths: number[] = [...STROKE_WIDTH_OPTIONS]
  if (!widths.includes(value)) {
    widths.push(value)
    widths.sort((left, right) => left - right)
  }

  return (
    <div className="flex items-center gap-2">
      <span id="stroke-width-label" className="text-xs font-medium text-muted-foreground">
        Border width
      </span>
      <Select
        value={String(value)}
        disabled={disabled}
        onValueChange={(next: string | null) => {
          const parsed = parseSelectNumber(next)
          if (parsed !== null) {
            onChange(parsed)
          }
        }}
      >
        <SelectTrigger
          id="stroke-width-select"
          size="sm"
          disabled={disabled}
          className="min-w-[5.25rem] bg-background font-medium shadow-xs hover:bg-muted/60"
          aria-labelledby="stroke-width-label"
        >
          <SelectValue placeholder="Width">{value} pt</SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          {widths.map((width) => (
            <SelectItem key={width} value={String(width)}>
              {width} pt
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function FontSizeSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: number
  onChange: (fontSize: number) => void
  disabled?: boolean
}) {
  const sizes: number[] = [...FONT_SIZE_OPTIONS]
  if (!sizes.includes(value)) {
    sizes.push(value)
    sizes.sort((left, right) => left - right)
  }

  return (
    <div className="flex items-center gap-2">
      <span id="font-size-label" className="text-xs font-medium text-muted-foreground">
        Font size
      </span>
      <Select
        value={String(value)}
        disabled={disabled}
        onValueChange={(next: string | null) => {
          const parsed = parseSelectNumber(next)
          if (parsed !== null) {
            onChange(parsed)
          }
        }}
      >
        <SelectTrigger
          id="font-size-select"
          size="sm"
          disabled={disabled}
          className="min-w-[5.75rem] bg-background font-medium shadow-xs hover:bg-muted/60"
          aria-labelledby="font-size-label"
        >
          <SelectValue placeholder="Size">{value} pt</SelectValue>
        </SelectTrigger>
        <SelectContent align="start" className="max-h-60">
          {sizes.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size} pt
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ToggleFormat({
  label,
  pressed,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  pressed: boolean
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      disabled={disabled}
      variant={pressed ? 'default' : 'outline'}
      className={cn(
        'size-9 rounded-xl [&_svg]:text-current',
        !pressed && 'border-border bg-background text-foreground hover:bg-muted/70',
      )}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
