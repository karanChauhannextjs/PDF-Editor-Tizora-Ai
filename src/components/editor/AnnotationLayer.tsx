import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { Annotation, AnnotationTool, Point } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import type { AnnotationAction } from '@/utils/annotationReducer'
import {
  annotationFromDraft,
  isSignificantShape,
  shapeDraftFromDrag,
  type ShapeDraft,
} from '@/utils/annotationGeometry'
import {
  type ResizeHandle,
  clampAnnotationToPage,
  resizeAnnotation,
  rotateAnnotation,
} from '@/utils/annotationTransform'
import { clientToPagePoint } from '@/utils/coordinates'
import { AnnotationItem } from '@/components/editor/AnnotationItem'
import { SelectionHandles } from '@/components/editor/SelectionHandles'

/** Matches Tailwind `max-md` — scroll lock while dragging applies only on small screens. */
const MOBILE_MAX_WIDTH_MEDIA = '(max-width: 767px)'

function isMobileViewport(): boolean {
  return window.matchMedia(MOBILE_MAX_WIDTH_MEDIA).matches
}

type AnnotationLayerProps = {
  page: PdfPageDimensions
  tool: AnnotationTool | null
  drawStroke: string
  drawStrokeWidth: number
  annotations: Annotation[]
  selectedId: string | null
  editingTextId: string | null
  hideSelectionChrome: boolean
  dispatch: (action: AnnotationAction, options?: { skipHistory?: boolean }) => void
  onTextRequest: (point: Point) => void
  onEditText: (annotation: Annotation) => void
  onBeginHistoryTransaction: () => void
  onEndHistoryTransaction: () => void
}

type DragState =
  | {
      kind: 'draw'
      tool: 'rectangle' | 'circle' | 'line'
      start: Point
      pointerId: number
    }
  | { kind: 'move'; id: string; last: Point; pointerId: number }
  | { kind: 'resize'; id: string; handle: ResizeHandle; pointerId: number }
  | {
      kind: 'rotate'
      id: string
      pointerId: number
      startPointer: Point
      startRotation: number
    }

export function AnnotationLayer({
  page,
  tool,
  drawStroke,
  drawStrokeWidth,
  annotations,
  selectedId,
  editingTextId,
  hideSelectionChrome,
  dispatch,
  onTextRequest,
  onEditText,
  onBeginHistoryTransaction,
  onEndHistoryTransaction,
}: AnnotationLayerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [preview, setPreview] = useState<ShapeDraft | null>(null)
  const [isTransforming, setIsTransforming] = useState(false)
  const [isGesturing, setIsGesturing] = useState(false)

  const selected = annotations.find((annotation) => annotation.id === selectedId) ?? null

  useEffect(() => {
    if (!isGesturing || !isMobileViewport()) {
      return
    }

    const scrollParents: HTMLElement[] = []
    let node: HTMLElement | null = svgRef.current?.parentElement ?? null
    while (node) {
      const { overflowY } = getComputedStyle(node)
      if (overflowY === 'auto' || overflowY === 'scroll') {
        scrollParents.push(node)
      }
      node = node.parentElement
    }

    const previousOverflow = scrollParents.map((element) => element.style.overflow)
    scrollParents.forEach((element) => {
      element.style.overflow = 'hidden'
    })

    const blockTouchScroll = (event: TouchEvent) => {
      event.preventDefault()
    }
    document.addEventListener('touchmove', blockTouchScroll, { passive: false })

    return () => {
      scrollParents.forEach((element, index) => {
        element.style.overflow = previousOverflow[index]
      })
      document.removeEventListener('touchmove', blockTouchScroll)
    }
  }, [isGesturing])

  const beginGesture = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      event.preventDefault()
    }
    setIsGesturing(true)
  }

  const endGesture = () => {
    setIsGesturing(false)
  }

  const readPoint = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    if (!svg) {
      return null
    }
    return clientToPagePoint(event.clientX, event.clientY, svg.getBoundingClientRect(), page)
  }

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return
    }
    const point = readPoint(event)
    if (!point) {
      return
    }
    if (!tool) {
      return
    }
    if (tool === 'text') {
      onTextRequest(point)
      return
    }
    if (tool === 'select') {
      dispatch({ type: 'select', id: null })
      return
    }

    beginGesture(event)
    capturePointer(event.currentTarget, event.pointerId)
    dragRef.current = {
      kind: 'draw',
      tool,
      start: point,
      pointerId: event.pointerId,
    }
    setPreview(null)
  }

  const handleAnnotationPointerDown = (
    event: PointerEvent<SVGGElement>,
    annotation: Annotation,
  ) => {
    event.stopPropagation()
    if (tool !== 'select') {
      return
    }
    const point = readPoint(event)
    if (!point || !svgRef.current) {
      return
    }
    onBeginHistoryTransaction()
    dispatch({ type: 'select', id: annotation.id })
    beginGesture(event)
    capturePointer(svgRef.current, event.pointerId)
    dragRef.current = {
      kind: 'move',
      id: annotation.id,
      last: point,
      pointerId: event.pointerId,
    }
    setIsTransforming(true)
  }

  const handleHandlePointerDown = (
    event: PointerEvent<SVGCircleElement | SVGGElement>,
    handle: ResizeHandle | 'rotate',
  ) => {
    if (tool !== 'select' || !selected) {
      return
    }
    const point = readPoint(event)
    if (!point || !svgRef.current) {
      return
    }
    event.stopPropagation()
    onBeginHistoryTransaction()
    beginGesture(event)
    capturePointer(svgRef.current, event.pointerId)
    dispatch({ type: 'select', id: selected.id })
    if (handle === 'rotate') {
      dragRef.current = {
        kind: 'rotate',
        id: selected.id,
        pointerId: event.pointerId,
        startPointer: point,
        startRotation: selected.rotation ?? 0,
      }
    } else {
      dragRef.current = {
        kind: 'resize',
        id: selected.id,
        handle,
        pointerId: event.pointerId,
      }
    }
    setIsTransforming(true)
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }
    const point = readPoint(event)
    if (!point) {
      return
    }
    if (drag.kind === 'draw') {
      setPreview(shapeDraftFromDrag(drag.tool, drag.start, point, page))
      return
    }
    const annotation = annotations.find((entry) => entry.id === drag.id)
    if (!annotation) {
      return
    }
    if (drag.kind === 'move') {
      const dx = point.x - drag.last.x
      const dy = point.y - drag.last.y
      if (dx === 0 && dy === 0) {
        return
      }
      dispatch({ type: 'move', id: drag.id, dx, dy, page }, { skipHistory: true })
      dragRef.current = { ...drag, last: point }
      return
    }
    if (drag.kind === 'resize') {
      const next = resizeAnnotation(annotation, drag.handle, point, page)
      dispatch(
        {
          type: 'updateAnnotation',
          id: drag.id,
          annotation: next,
        },
        { skipHistory: true },
      )
      return
    }
    const next = rotateAnnotation(annotation, point, drag.startPointer, drag.startRotation, page)
    dispatch(
      {
        type: 'updateAnnotation',
        id: drag.id,
        annotation: next,
      },
      { skipHistory: true },
    )
  }

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }
    const point = readPoint(event)
    const wasTransform = drag.kind === 'move' || drag.kind === 'resize' || drag.kind === 'rotate'
    dragRef.current = null
    setIsTransforming(false)
    endGesture()
    releasePointer(event.currentTarget, event.pointerId)
    if (wasTransform) {
      onEndHistoryTransaction()
    }
    if (drag.kind !== 'draw') {
      setPreview(null)
      return
    }
    if (!point) {
      return
    }
    const draft = shapeDraftFromDrag(drag.tool, drag.start, point, page)
    setPreview(null)
    if (!draft || !isSignificantShape(draft)) {
      return
    }
    dispatch({
      type: 'add',
      annotation: clampAnnotationToPage(
        annotationFromDraft(draft, drawStroke, drawStrokeWidth),
        page,
      ),
    })
  }

  const cursorClass = !tool
    ? 'cursor-default'
    : tool === 'select'
      ? isTransforming
        ? 'cursor-grabbing'
        : 'cursor-default'
      : tool === 'text'
        ? 'cursor-text'
        : 'cursor-crosshair'

  const needsPreciseTouch =
    isGesturing ||
    isTransforming ||
    tool === 'rectangle' ||
    tool === 'circle' ||
    tool === 'line' ||
    tool === 'text'
  const touchClass = needsPreciseTouch ? 'touch-none' : 'touch-pan-y'

  return (
    <svg
      ref={svgRef}
      data-testid="annotation-svg"
      className={`absolute inset-0 h-full w-full ${touchClass} ${cursorClass}`}
      viewBox={`0 0 ${page.width} ${page.height}`}
      role="application"
      aria-label="Annotation layer"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <rect
        data-testid="annotation-surface"
        x={0}
        y={0}
        width={page.width}
        height={page.height}
        fill="transparent"
      />
      {annotations.map((annotation) =>
        annotation.id === editingTextId ? null : (
          <AnnotationItem
            key={annotation.id}
            annotation={annotation}
            showSelectionOutline={annotation.id === selectedId && !hideSelectionChrome}
            interactive={tool === 'select'}
            onPointerDown={handleAnnotationPointerDown}
            onEditText={onEditText}
          />
        ),
      )}
      {selected && tool === 'select' && !hideSelectionChrome && selected.id !== editingTextId ? (
        <SelectionHandles annotation={selected} onHandlePointerDown={handleHandlePointerDown} />
      ) : null}
      {preview ? (
        <PreviewShape draft={preview} stroke={drawStroke} strokeWidth={drawStrokeWidth} />
      ) : null}
    </svg>
  )
}

function capturePointer(element: Element, pointerId: number) {
  if (typeof element.setPointerCapture !== 'function') {
    return
  }
  try {
    element.setPointerCapture(pointerId)
  } catch (error) {
    console.error('Could not capture the pointer', error)
  }
}

function releasePointer(element: Element, pointerId: number) {
  if (typeof element.hasPointerCapture !== 'function') {
    return
  }
  if (element.hasPointerCapture(pointerId)) {
    element.releasePointerCapture(pointerId)
  }
}

function PreviewShape({
  draft,
  stroke,
  strokeWidth,
}: {
  draft: ShapeDraft
  stroke: string
  strokeWidth: number
}) {
  const shared = {
    fill: 'none' as const,
    stroke,
    strokeWidth,
    strokeDasharray: '5 4',
    pointerEvents: 'none' as const,
  }

  switch (draft.type) {
    case 'rectangle':
      return <rect x={draft.x} y={draft.y} width={draft.width} height={draft.height} {...shared} />
    case 'circle':
      return <circle cx={draft.cx} cy={draft.cy} r={draft.radius} {...shared} />
    case 'line':
      return (
        <line x1={draft.start.x} y1={draft.start.y} x2={draft.end.x} y2={draft.end.y} {...shared} />
      )
    default: {
      const unreachable: never = draft
      return unreachable
    }
  }
}
