import type { PdfPageDimensions } from '@/types/pdf'

export type TextDraft =
  | { mode: 'create'; x: number; y: number }
  | { mode: 'edit'; id: string; x: number; y: number; text: string }

export type PendingAction =
  { kind: 'open-pdf'; file: File } | { kind: 'import'; documentJson: string }

export type PdfEditorOptions = {
  initialPage?: PdfPageDimensions
}
