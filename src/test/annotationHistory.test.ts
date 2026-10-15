import { describe, expect, it } from 'vitest'
import type { Annotation } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'
import {
  annotationRootReducer,
  cloneAnnotationRootState,
  initialAnnotationRootState,
  rootStatesEqual,
  type AnnotationRootState,
} from '@/utils/annotationRootReducer'

const PAGE_INDEX = 1

const page: PdfPageDimensions = { width: 600, height: 800 }

type HistoryState = {
  past: AnnotationRootState[]
  present: AnnotationRootState
  future: AnnotationRootState[]
}

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

function recordsHistory(type: string): boolean {
  return type !== 'select' && type !== 'setPageDimensions'
}

function applyAction(
  history: HistoryState,
  action: Parameters<typeof annotationRootReducer>[1],
): HistoryState {
  const nextPresent = annotationRootReducer(history.present, action)
  if (rootStatesEqual(nextPresent, history.present)) {
    return history
  }
  const shouldRecord = recordsHistory(action.type)
  if (!shouldRecord) {
    return { ...history, present: nextPresent }
  }
  return {
    past: [...history.past, cloneAnnotationRootState(history.present)],
    present: nextPresent,
    future: [],
  }
}

function undo(history: HistoryState): HistoryState {
  if (history.past.length === 0) {
    return history
  }
  const previous = history.past[history.past.length - 1]
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [cloneAnnotationRootState(history.present), ...history.future],
  }
}

function redo(history: HistoryState): HistoryState {
  if (history.future.length === 0) {
    return history
  }
  const [next, ...future] = history.future
  return {
    past: [...history.past, cloneAnnotationRootState(history.present)],
    present: next,
    future,
  }
}

function strokeOf(state: AnnotationRootState, id: string): string | undefined {
  const annotation = state.pages[PAGE_INDEX]?.annotations.find((entry) => entry.id === id)
  if (!annotation || annotation.type === 'text') {
    return undefined
  }
  return annotation.stroke
}

function countOnPage(state: AnnotationRootState): number {
  return state.pages[PAGE_INDEX]?.annotations.length ?? 0
}

function xOf(state: AnnotationRootState, id: string): number | undefined {
  const annotation = state.pages[PAGE_INDEX]?.annotations.find((entry) => entry.id === id)
  if (!annotation || annotation.type !== 'rectangle') {
    return undefined
  }
  return annotation.x
}

function applyDuringGesture(
  history: HistoryState,
  action: Parameters<typeof annotationRootReducer>[1],
): HistoryState {
  const nextPresent = annotationRootReducer(history.present, action)
  if (rootStatesEqual(nextPresent, history.present)) {
    return history
  }
  return { ...history, present: nextPresent }
}

function endGestureTransaction(history: HistoryState, snapshot: AnnotationRootState): HistoryState {
  if (rootStatesEqual(snapshot, history.present)) {
    return history
  }
  return {
    past: [...history.past, cloneAnnotationRootState(snapshot)],
    present: history.present,
    future: [],
  }
}

describe('annotation undo/redo history', () => {
  it('records one undo step for a drag with many move updates', () => {
    let history: HistoryState = {
      past: [],
      present: initialAnnotationRootState,
      future: [],
    }

    history = applyAction(history, {
      type: 'add',
      pageIndex: PAGE_INDEX,
      annotation: rectangle,
    })
    expect(xOf(history.present, rectangle.id)).toBe(10)

    const dragStart = cloneAnnotationRootState(history.present)
    history = applyDuringGesture(history, {
      type: 'move',
      pageIndex: PAGE_INDEX,
      id: rectangle.id,
      dx: 5,
      dy: 0,
      page,
    })
    history = applyDuringGesture(history, {
      type: 'move',
      pageIndex: PAGE_INDEX,
      id: rectangle.id,
      dx: 10,
      dy: 3,
      page,
    })
    history = applyDuringGesture(history, {
      type: 'move',
      pageIndex: PAGE_INDEX,
      id: rectangle.id,
      dx: 2,
      dy: 1,
      page,
    })
    expect(xOf(history.present, rectangle.id)).toBe(27)
    expect(history.past).toHaveLength(1)

    history = endGestureTransaction(history, dragStart)
    expect(history.past).toHaveLength(2)
    expect(xOf(history.past[1], rectangle.id)).toBe(10)

    history = undo(history)
    expect(xOf(history.present, rectangle.id)).toBe(10)

    history = redo(history)
    expect(xOf(history.present, rectangle.id)).toBe(27)
  })

  it('restores stroke color on redo after undo', () => {
    let history: HistoryState = {
      past: [],
      present: initialAnnotationRootState,
      future: [],
    }

    history = applyAction(history, {
      type: 'add',
      pageIndex: PAGE_INDEX,
      annotation: rectangle,
    })
    history = applyAction(history, {
      type: 'updateStroke',
      pageIndex: PAGE_INDEX,
      id: rectangle.id,
      stroke: '#000000',
    })
    expect(strokeOf(history.present, rectangle.id)).toBe('#000000')

    history = undo(history)
    expect(strokeOf(history.present, rectangle.id)).toBe('#1d4ed8')
    expect(history.future).toHaveLength(1)

    history = applyAction(history, {
      type: 'add',
      pageIndex: PAGE_INDEX,
      annotation: circle,
    })
    expect(history.future).toHaveLength(0)
    expect(countOnPage(history.present)).toBe(2)

    history = applyAction(history, {
      type: 'updateStroke',
      pageIndex: PAGE_INDEX,
      id: circle.id,
      stroke: '#0000ff',
    })
    expect(strokeOf(history.present, circle.id)).toBe('#0000ff')

    history = undo(history)
    expect(strokeOf(history.present, circle.id)).toBe('#1d4ed8')

    history = redo(history)
    expect(strokeOf(history.present, circle.id)).toBe('#0000ff')
  })

  it('does not mutate prior history entries when present changes', () => {
    let history: HistoryState = {
      past: [],
      present: initialAnnotationRootState,
      future: [],
    }
    history = applyAction(history, {
      type: 'add',
      pageIndex: PAGE_INDEX,
      annotation: rectangle,
    })
    history = applyAction(history, {
      type: 'updateStroke',
      pageIndex: PAGE_INDEX,
      id: rectangle.id,
      stroke: '#000000',
    })
    const pastSnapshot = history.past[0]
    const pastStroke = strokeOf(pastSnapshot, rectangle.id)

    history = applyAction(history, {
      type: 'updateStroke',
      pageIndex: PAGE_INDEX,
      id: rectangle.id,
      stroke: '#ff0000',
    })

    expect(strokeOf(pastSnapshot, rectangle.id)).toBe(pastStroke)
    expect(strokeOf(history.past[1], rectangle.id)).toBe('#1d4ed8')
  })
})
