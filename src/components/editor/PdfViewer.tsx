import { memo, type ReactNode } from 'react'
import type { PdfPageDimensions } from '@/types/pdf'
import { cssWidthForPage } from '@/utils/coordinates'

type PdfViewerProps = {
  page: PdfPageDimensions
  showCanvas: boolean
  fileName: string | null
  pageCount: number
  currentPageIndex: number
  canvasRef: (node: HTMLCanvasElement | null) => void
  children: ReactNode
}

export function PdfViewer({
  page,
  showCanvas,
  fileName,
  pageCount,
  currentPageIndex,
  canvasRef,
  children,
}: PdfViewerProps) {
  const width = cssWidthForPage(page)
  const pageLabel = fileName
    ? `${fileName}, page ${currentPageIndex} of ${pageCount}`
    : 'Blank page for imported annotations'

  return (
    <div className="mx-auto w-full" style={{ maxWidth: width }}>
      <div
        className="relative w-full bg-white shadow-sm ring-1 ring-border"
        style={{ aspectRatio: `${page.width} / ${page.height}` }}
      >
        {showCanvas ? <PdfPageCanvas canvasRef={canvasRef} pageLabel={pageLabel} /> : null}
        {children}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {fileName
          ? `${fileName} · page ${currentPageIndex} of ${pageCount}`
          : 'Annotations only · no PDF loaded'}
      </p>
    </div>
  )
}

const PdfPageCanvas = memo(function PdfPageCanvas({
  canvasRef,
  pageLabel,
}: {
  canvasRef: (node: HTMLCanvasElement | null) => void
  pageLabel: string
}) {
  return (
    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={pageLabel} />
  )
})
