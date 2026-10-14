import { describe, expect, it } from 'vitest'
import type { Annotation } from '@/types/annotation'
import {
  annotationRootReducer,
  initialAnnotationRootState,
} from '@/utils/annotationRootReducer'

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

describe('annotationRootReducer', () => {
  it('keeps annotations isolated per page', () => {
    const withPageOne = annotationRootReducer(initialAnnotationRootState, {
      type: 'add',
      pageIndex: 1,
      annotation: rectangle,
    })
    const withPageTwo = annotationRootReducer(withPageOne, {
      type: 'add',
      pageIndex: 2,
      annotation: { ...rectangle, id: 'rect-2', x: 50 },
    })

    expect(withPageTwo.pages[1]?.annotations).toHaveLength(1)
    expect(withPageTwo.pages[2]?.annotations).toHaveLength(1)
  })
})
