import { describe, expect, it } from 'vitest'
import { rectangleFromDrag } from '@/utils/annotationGeometry'
import { clientToPagePoint } from '@/utils/coordinates'

describe('annotation geometry', () => {
  it('normalizes a rectangle dragged from bottom-right to top-left', () => {
    expect(rectangleFromDrag({ x: 80, y: 50 }, { x: 20, y: 10 })).toEqual({
      type: 'rectangle',
      x: 20,
      y: 10,
      width: 60,
      height: 40,
    })
  })

  it('maps a pointer through a CSS-scaled page box', () => {
    const point = clientToPagePoint(
      110,
      220,
      { left: 10, top: 20, width: 200, height: 400 },
      { width: 100, height: 200 },
    )

    expect(point).toEqual({ x: 50, y: 100 })
  })
})
