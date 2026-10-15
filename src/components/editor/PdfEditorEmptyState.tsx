import { FolderOpen } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  acceptSelectedFile,
  fileHeaderButtonClass,
} from '@/components/editor/FileControls'
import { cn } from '@/lib/utils'

const NO_PDF_IMAGE = `${import.meta.env.BASE_URL}no-data.png`

type PdfEditorEmptyStateProps = {
  isLoading: boolean
  onOpenPdf: (file: File) => void
  onFileError: (message: string) => void
}

export function PdfEditorEmptyState({
  isLoading,
  onOpenPdf,
  onFileError,
}: PdfEditorEmptyStateProps) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center"
      role="status"
      aria-live="polite"
    >
      <img
        src={NO_PDF_IMAGE}
        alt=""
        width={60}
        height={60}
        className="h-15 w-15 object-contain"
        decoding="async"
      />
      <div className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          No PDF selected
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Upload a document to view pages and add shapes and text notes. You can
          export annotations as JSON or download an annotated PDF when you are
          done.
        </p>
        <label
          className={cn(
            buttonVariants({ variant: 'default', size: 'sm' }),
            fileHeaderButtonClass,
            'mx-auto mt-1',
            isLoading && 'pointer-events-none opacity-50',
          )}
        >
          <FolderOpen />
          Open PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={isLoading}
            aria-label="Open PDF"
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0]
              if (!selected) {
                return
              }
              void acceptSelectedFile(
                event.currentTarget,
                selected,
                onOpenPdf,
                onFileError,
              )
            }}
          />
        </label>
      </div>
    </div>
  )
}
