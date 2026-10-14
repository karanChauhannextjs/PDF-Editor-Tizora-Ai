import type { PointerEvent } from 'react'
import type { Annotation } from '@/types/annotation'
import {
  HANDLE_RADIUS,
  ROTATE_HANDLE_OFFSET,
  type ResizeHandle,
  annotationRotation,
  getAnnotationPivot,
} from '@/utils/annotationTransform'
import { textBlockSize } from '@/utils/annotationGeometry'

type SelectionHandlesProps = {
  annotation: Annotation
  onHandlePointerDown: (
    event: PointerEvent<SVGCircleElement>,
    handle: ResizeHandle | 'rotate',
  ) => void
}

export function SelectionHandles({
  annotation,
  onHandlePointerDown,
}: SelectionHandlesProps) {
  const pivot = getAnnotationPivot(annotation)
  const rotation = annotationRotation(annotation)
  const showRotation = annotation.type !== 'circle'
  const transform =
    !showRotation || rotation === 0
      ? undefined
      : `rotate(${rotation} ${pivot.x} ${pivot.y})`

  const handleProps = (handle: ResizeHandle | 'rotate') => ({
    r: HANDLE_RADIUS,
    fill: '#000000',
    stroke: '#000000',
    strokeWidth: 1.5,
    className: handle === 'rotate' ? 'cursor-grab' : 'cursor-nwse-resize',
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
      {showRotation ? (
        <>
          <Handle
            cx={pivot.x}
            cy={pivot.y - ROTATE_HANDLE_OFFSET}
            {...handleProps('rotate')}
          />
          <line
            x1={pivot.x}
            y1={pivot.y}
            x2={pivot.x}
            y2={pivot.y - ROTATE_HANDLE_OFFSET}
            stroke="#000000"
            strokeWidth={1}
            pointerEvents="none"
          />
        </>
      ) : null}
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
