import type { PointerEvent } from 'react'
import { RotateCw } from 'lucide-react'
import type { Annotation } from '@/types/annotation'
import {
  HANDLE_RADIUS,
  type ResizeHandle,
  annotationRotation,
  getAnnotationPivot,
  getRotateHandleAnchor,
  getRotateHandlePoint,
} from '@/utils/annotationTransform'
import { textBlockSize } from '@/utils/annotationGeometry'

const ROTATE_PIN_RADIUS = 2.5
const ROTATE_ICON_SIZE = 18
const ROTATE_HIT_RADIUS = 11

type SelectionHandlesProps = {
  annotation: Annotation
  onHandlePointerDown: (
    event: PointerEvent<SVGCircleElement | SVGGElement>,
    handle: ResizeHandle | 'rotate',
  ) => void
}

export function SelectionHandles({
  annotation,
  onHandlePointerDown,
}: SelectionHandlesProps) {
  const pivot = getAnnotationPivot(annotation)
  const rotation = annotationRotation(annotation)
  const rotateAnchor = getRotateHandleAnchor(annotation)
  const rotatePoint = rotateAnchor ? getRotateHandlePoint(rotateAnchor) : null
  const transform =
    rotation === 0
      ? undefined
      : `rotate(${rotation} ${pivot.x} ${pivot.y})`

  const handleProps = (handle: ResizeHandle) => ({
    r: HANDLE_RADIUS,
    fill: '#000000',
    stroke: '#000000',
    strokeWidth: 1.5,
    className: 'cursor-nwse-resize',
    onPointerDown: (event: PointerEvent<SVGCircleElement>) => {
      event.stopPropagation()
      onHandlePointerDown(event, handle)
    },
  })

  return (
    <g transform={transform} pointerEvents="none">
      {annotation.type === 'rectangle' ? (
        <>
          <Handle cx={annotation.x} cy={annotation.y} {...handleProps('nw')} />
          <Handle
            cx={annotation.x + annotation.width}
            cy={annotation.y}
            {...handleProps('ne')}
          />
          <Handle
            cx={annotation.x}
            cy={annotation.y + annotation.height}
            {...handleProps('sw')}
          />
          <Handle
            cx={annotation.x + annotation.width}
            cy={annotation.y + annotation.height}
            {...handleProps('se')}
          />
        </>
      ) : null}
      {annotation.type === 'circle' ? (
        <Handle
          cx={annotation.cx + annotation.radius}
          cy={annotation.cy}
          {...handleProps('radius')}
        />
      ) : null}
      {annotation.type === 'line' ? (
        <>
          <Handle
            cx={annotation.start.x}
            cy={annotation.start.y}
            {...handleProps('start')}
          />
          <Handle
            cx={annotation.end.x}
            cy={annotation.end.y}
            {...handleProps('end')}
          />
        </>
      ) : null}
      {annotation.type === 'text' ? (
        (() => {
          const block = textBlockSize(annotation.text, annotation.fontSize)
          return (
            <Handle
              cx={annotation.x + block.width + 2}
              cy={annotation.y + block.height + 2}
              {...handleProps('text-scale')}
            />
          )
        })()
      ) : null}
      {rotateAnchor && rotatePoint ? (
        <RotateHandleControl
          anchor={rotateAnchor}
          handle={rotatePoint}
          onPointerDown={(event) => {
            event.stopPropagation()
            onHandlePointerDown(event, 'rotate')
          }}
        />
      ) : null}
    </g>
  )
}

function RotateHandleControl({
  anchor,
  handle,
  onPointerDown,
}: {
  anchor: { x: number; y: number }
  handle: { x: number; y: number }
  onPointerDown: (event: PointerEvent<SVGGElement>) => void
}) {
  const iconOffset = ROTATE_ICON_SIZE / 2

  return (
    <g pointerEvents="none">
      <line
        x1={anchor.x}
        y1={anchor.y}
        x2={handle.x}
        y2={handle.y}
        stroke="#000000"
        strokeWidth={1}
      />
      <g
        transform={`translate(${handle.x}, ${handle.y})`}
        className="cursor-grab"
        pointerEvents="all"
        onPointerDown={onPointerDown}
        role="button"
        aria-label="Rotate"
      >
        <circle r={ROTATE_HIT_RADIUS} fill="transparent" />
        <foreignObject
          x={-iconOffset}
          y={-iconOffset}
          width={ROTATE_ICON_SIZE}
          height={ROTATE_ICON_SIZE}
          pointerEvents="none"
        >
          <div className="flex h-full w-full items-center justify-center text-black">
            <RotateCw size={ROTATE_ICON_SIZE} strokeWidth={2} aria-hidden />
          </div>
        </foreignObject>
        <circle
          r={ROTATE_PIN_RADIUS}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={1}
          pointerEvents="none"
        />
      </g>
    </g>
  )
}

function Handle({
  cx,
  cy,
  onPointerDown,
  className,
  ...rest
}: {
  cx: number
  cy: number
  onPointerDown: (event: PointerEvent<SVGCircleElement>) => void
  className?: string
  r: number
  fill: string
  stroke: string
  strokeWidth: number
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      pointerEvents="all"
      className={className}
      onPointerDown={onPointerDown}
      {...rest}
    />
  )
}
