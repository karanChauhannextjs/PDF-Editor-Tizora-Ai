import { describe, expect, it } from 'vitest'
import type { Annotation } from '@/types/annotation'
import { annotationReducer, initialAnnotationState } from '@/utils/annotationReducer'

const page = { width: 500, height: 500 }

const rectangle: Annotation = {
  id: 'rect-1',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 30,
  height: 40,
  stroke: '#1d4ed8',
  strokeWidth: 2,
  rotation: 0,
}

const circle: Annotation = {
  id: 'circle-1',
  type: 'circle',
  cx: 80,
  cy: 90,
  radius: 10,
  stroke: '#1d4ed8',
  strokeWidth: 2,
  rotation: 0,
}

const line: Annotation = {
  id: 'line-1',
  type: 'line',
  start: { x: 5, y: 6 },
  end: { x: 25, y: 16 },
  stroke: '#1d4ed8',
  strokeWidth: 2,
  rotation: 0,
}

describe('annotationReducer', () => {
  it('adds an annotation and deletes only the matching id', () => {
    const withRectangle = annotationReducer(initialAnnotationState, {
      type: 'add',
      annotation: rectangle,
    })
    const withBoth = annotationReducer(withRectangle, {
      type: 'add',
      annotation: circle,
    })

    expect(withBoth.annotations).toEqual([rectangle, circle])
    expect(withBoth.selectedId).toBe('circle-1')

    const afterDelete = annotationReducer(withBoth, {
      type: 'delete',
      id: 'rect-1',
    })

    expect(afterDelete.annotations).toEqual([circle])
    expect(afterDelete.selectedId).toBe('circle-1')
    expect(withBoth.annotations).toEqual([rectangle, circle])
  })

  it('moves a rectangle, circle, and line without changing other annotations', () => {
    const state = {
      annotations: [rectangle, circle, line],
      selectedId: rectangle.id,
    }

    const movedRectangle = annotationReducer(state, {
      type: 'move',
      id: rectangle.id,
      dx: 15,
      dy: -5,
      page,
    })
    expect(movedRectangle.annotations[0]).toEqual({
      ...rectangle,
      x: 25,
      y: 15,
    })
    expect(movedRectangle.annotations[0]).not.toBe(rectangle)
    expect(movedRectangle.annotations[1]).toBe(circle)
    expect(movedRectangle.annotations[2]).toBe(line)
    expect(state.annotations[0]).toEqual(rectangle)

    const movedCircle = annotationReducer(movedRectangle, {
      type: 'move',
      id: circle.id,
      dx: 4,
      dy: 6,
      page,
    })
    expect(movedCircle.annotations[1]).toEqual({ ...circle, cx: 84, cy: 96 })
    expect(movedCircle.annotations[0]).toBe(movedRectangle.annotations[0])

    const movedLine = annotationReducer(movedCircle, {
      type: 'move',
      id: line.id,
      dx: 10,
      dy: 3,
      page,
    })
    expect(movedLine.annotations[2]).toEqual({
      ...line,
      start: { x: 15, y: 9 },
      end: { x: 35, y: 19 },
    })
    expect(movedLine.annotations[1]).toBe(movedCircle.annotations[1])
  })
})
