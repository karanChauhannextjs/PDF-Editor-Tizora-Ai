import type { Annotation, TextFormat } from '@/types/annotation'
import { DEFAULT_TEXT_FORMAT } from '@/types/annotation'

export const FONT_SIZE_OPTIONS = [
  4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32, 40,
] as const

export const MIN_FONT_SIZE = FONT_SIZE_OPTIONS[0]
export const MAX_FONT_SIZE = FONT_SIZE_OPTIONS[FONT_SIZE_OPTIONS.length - 1]

export function clampFontSize(fontSize: number): number {
  const rounded = Math.round(fontSize)
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, rounded))
}

export const STROKE_WIDTH_OPTIONS = [1, 2, 3, 4, 6, 8, 10, 12] as const

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function isShapeAnnotation(
  annotation: Annotation,
): annotation is Exclude<Annotation, { type: 'text' }> {
  return annotation.type !== 'text'
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('#')) {
    return normalizeHexColor(`#${trimmed}`)
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  return null
}

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

export function textFormatFromAnnotation(
  annotation: TextFormat | undefined,
): TextFormat {
  if (!annotation) {
    return DEFAULT_TEXT_FORMAT
  }
  return {
    fontSize: annotation.fontSize,
    color: annotation.color,
    bold: annotation.bold ?? false,
    italic: annotation.italic ?? false,
    underline: annotation.underline ?? false,
  }
}
