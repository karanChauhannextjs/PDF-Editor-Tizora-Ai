import type { Point } from '@/types/annotation'
import type { PdfPageDimensions } from '@/types/pdf'

export const MAX_DISPLAY_WIDTH = 960

export type ClientBounds = {
  left: number
  top: number
  width: number
  height: number
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min
  }
  return Math.min(max, Math.max(min, value))
}

export function cssWidthForPage(page: PdfPageDimensions): number {
  return Math.min(MAX_DISPLAY_WIDTH, page.width)
}

/**
 * Converts a pointer position into PDF page coordinates.
 * `getBoundingClientRect` already includes CSS scaling and browser zoom,
 * so the ratio of the pointer inside the rendered page is enough.
 */
export function clientToPagePoint(
  clientX: number,
  clientY: number,
  bounds: ClientBounds,
  page: PdfPageDimensions,
): Point | null {
  if (
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    page.width <= 0 ||
    page.height <= 0
  ) {
    return null
  }

  return {
    x: clamp(
      ((clientX - bounds.left) / bounds.width) * page.width,
      0,
      page.width,
    ),
    y: clamp(
      ((clientY - bounds.top) / bounds.height) * page.height,
      0,
      page.height,
    ),
  }
}

export function pagesMatch(
  left: PdfPageDimensions,
  right: PdfPageDimensions,
): boolean {
  return (
    Math.abs(left.width - right.width) < 0.01 &&
    Math.abs(left.height - right.height) < 0.01
  )
}
