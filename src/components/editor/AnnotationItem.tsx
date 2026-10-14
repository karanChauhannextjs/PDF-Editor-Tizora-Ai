import type { PointerEvent, ReactNode } from 'react'
import type { Annotation } from '@/types/annotation'
import { textBlockSize } from '@/utils/annotationGeometry'
import {
  annotationRotation,
  getAnnotationPivot,
} from '@/utils/annotationTransform'

type AnnotationItemProps = {
  annotation: Annotation
  showSelectionOutline: boolean
  interactive: boolean
  onPointerDown: (
    event: PointerEvent<SVGGElement>,
    annotation: Annotation,
  ) => void
  onEditText: (annotation: Annotation) => void
}

export function AnnotationItem({
  annotation,
  showSelectionOutline,
  interactive,
  onPointerDown,
  onEditText,
}: AnnotationItemProps) {
  const handlePointerDown = (event: PointerEvent<SVGGElement>) => {
    if (!interactive) {
      return
    }
    onPointerDown(event, annotation)
  }

  const interaction = {
    onPointerDown: handlePointerDown,
    className: interactive ? 'cursor-grab active:cursor-grabbing' : undefined,
    style: { pointerEvents: interactive ? 'auto' : 'none' } as const,
  }

  const pivot = getAnnotationPivot(annotation)
  const rotation = annotationRotation(annotation)
  const rotationTransform =
    rotation === 0
      ? undefined
      : `rotate(${rotation} ${pivot.x} ${pivot.y})`

  const wrap = (content: ReactNode) => (
    <g
      data-annotation-id={annotation.id}
      transform={rotationTransform}
      {...interaction}
    >
      {content}
    </g>
  )

  switch (annotation.type) {
    case 'rectangle':
      return wrap(
        <>
          <rect
            x={annotation.x}
            y={annotation.y}
            width={annotation.width}
            height={annotation.height}
            fill="transparent"
            stroke={annotation.stroke}
            strokeWidth={annotation.strokeWidth}
          />
          {showSelectionOutline ? (
            <rect
              x={annotation.x}
              y={annotation.y}
              width={annotation.width}
              height={annotation.height}
              fill="none"
              stroke="#111827"
              strokeWidth={1}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          ) : null}
        </>,
      )
    case 'circle':
      return wrap(
        <>
          <circle
            cx={annotation.cx}
            cy={annotation.cy}
            r={annotation.radius}
            fill="transparent"
            stroke={annotation.stroke}
            strokeWidth={annotation.strokeWidth}
          />
          {showSelectionOutline ? (
            <circle
              cx={annotation.cx}
              cy={annotation.cy}
              r={annotation.radius}
              fill="none"
              stroke="#111827"
              strokeWidth={1}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          ) : null}
        </>,
      )
    case 'line':
      return wrap(
        <>
          <line
            x1={annotation.start.x}
            y1={annotation.start.y}
            x2={annotation.end.x}
            y2={annotation.end.y}
            stroke="transparent"
            strokeWidth={Math.max(annotation.strokeWidth, 12)}
            strokeLinecap="round"
          />
          <line
            x1={annotation.start.x}
            y1={annotation.start.y}
            x2={annotation.end.x}
            y2={annotation.end.y}
            stroke={annotation.stroke}
            strokeWidth={annotation.strokeWidth}
            strokeLinecap="round"
            pointerEvents="none"
          />
          {showSelectionOutline ? (
            <line
              x1={annotation.start.x}
              y1={annotation.start.y}
              x2={annotation.end.x}
              y2={annotation.end.y}
              stroke="#111827"
              strokeWidth={1}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          ) : null}
        </>,
      )
    case 'text': {
      const block = textBlockSize(annotation.text, annotation.fontSize)
      const lines = annotation.text.split('\n')
      const textNode = (
        <text
          x={annotation.x}
          y={annotation.y}
          fill={annotation.color}
          fontSize={annotation.fontSize}
          fontFamily="sans-serif"
          fontWeight={annotation.bold ? 'bold' : 'normal'}
          fontStyle={annotation.italic ? 'italic' : 'normal'}
          textDecoration={annotation.underline ? 'underline' : 'none'}
          dominantBaseline="hanging"
          pointerEvents="none"
        >
          {lines.map((line, index) => (
            <tspan
              key={`${annotation.id}-${index}`}
              x={annotation.x}
              dy={index === 0 ? 0 : annotation.fontSize}
            >
              {line}
            </tspan>
          ))}
        </text>
      )
      return (
        <g
          data-annotation-id={annotation.id}
          transform={rotationTransform}
          {...interaction}
          onDoubleClick={(event) => {
            event.stopPropagation()
            onEditText(annotation)
          }}
        >
          <rect
            x={annotation.x - 2}
            y={annotation.y - 2}
            width={block.width + 4}
            height={block.height + 4}
            fill="transparent"
          />
          {showSelectionOutline ? (
            <rect
              x={annotation.x - 2}
              y={annotation.y - 2}
              width={block.width + 4}
              height={block.height + 4}
              fill="none"
              stroke="#111827"
              strokeWidth={1}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          ) : null}
          {textNode}
        </g>
      )
    }
    default: {
      const unreachable: never = annotation
      return unreachable
    }
  }
}
