import { Download, Eraser, FileDown, FileOutput, FileX2, FolderOpen, Upload } from 'lucide-react'
import { SAMPLE_ANNOTATION_DOCUMENT } from '@/data/sampleAnnotationDocument'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { downloadAnnotationDocument } from '@/utils/annotationPersistence'
import { cloneSelectedFile } from '@/utils/fileValidation'

type FileControlsProps = {
  canImport: boolean
  canExport: boolean
  canDownloadPdf: boolean
  isLoading: boolean
  isDownloadingPdf: boolean
  onOpenPdf: (file: File) => void
  onImportAnnotations: (file: File) => void
  onExportAnnotations: () => void
  onDownloadPdf: () => void
  canResetAnnotations: boolean
  onResetAnnotations: () => void
  canRemovePdf: boolean
  onRemovePdf: () => void
  onFileError: (message: string) => void
}

export function FileControls({
  canImport,
  canExport,
  canDownloadPdf,
  isLoading,
  isDownloadingPdf,
  onOpenPdf,
  onImportAnnotations,
  onExportAnnotations,
  onDownloadPdf,
  canResetAnnotations,
  onResetAnnotations,
  canRemovePdf,
  onRemovePdf,
  onFileError,
}: FileControlsProps) {
  const primaryActionClass = cn(
    buttonVariants({ variant: 'default', size: 'sm' }),
    fileHeaderButtonClass,
  )
  const secondaryActionClass = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    fileHeaderButtonClass,
    'border-border bg-background text-foreground hover:bg-muted/70',
  )

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        'max-md:flex-nowrap max-md:overflow-x-auto max-md:scroll-px-4 max-md:pe-4 max-md:pb-1 max-md:[-webkit-overflow-scrolling:touch] max-md:[&>*]:shrink-0',
        'md:flex-wrap',
      )}
    >
      <label className={cn(primaryActionClass, isLoading && 'pointer-events-none opacity-50')}>
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
            void acceptSelectedFile(event.currentTarget, selected, onOpenPdf, onFileError)
          }}
        />
      </label>
      <button
        type="button"
        className={secondaryActionClass}
        onClick={() =>
          downloadAnnotationDocument(SAMPLE_ANNOTATION_DOCUMENT, 'sample-annotations.json')
        }
      >
        <FileDown />
        Sample JSON
      </button>
      <label className={cn(secondaryActionClass, !canImport && 'pointer-events-none opacity-50')}>
        <Upload />
        Import JSON
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          disabled={!canImport}
          aria-label="Import annotations JSON"
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0]
            if (!selected) {
              return
            }
            void acceptSelectedFile(event.currentTarget, selected, onImportAnnotations, onFileError)
          }}
        />
      </label>
      <button
        type="button"
        className={secondaryActionClass}
        disabled={!canExport}
        onClick={onExportAnnotations}
      >
        <Download />
        Export JSON
      </button>
      <button
        type="button"
        className={primaryActionClass}
        disabled={!canDownloadPdf || isDownloadingPdf}
        onClick={onDownloadPdf}
      >
        <FileOutput />
        {isDownloadingPdf ? 'Preparing…' : 'Download PDF'}
      </button>
      <button
        type="button"
        className={secondaryActionClass}
        disabled={!canResetAnnotations}
        aria-label="Reset annotations"
        onClick={onResetAnnotations}
      >
        <Eraser />
        Reset annotations
      </button>
      <button
        type="button"
        className={secondaryActionClass}
        disabled={!canRemovePdf || isLoading}
        aria-label="Remove PDF"
        onClick={onRemovePdf}
      >
        <FileX2 />
        Remove PDF
      </button>
    </div>
  )
}

/** Matches header file actions: pill shape, icon + label spacing. */
export const fileHeaderButtonClass = 'h-9 gap-2 rounded-xl px-4 text-sm [&_svg]:text-current'

export async function acceptSelectedFile(
  input: HTMLInputElement,
  selected: File,
  onFile: (file: File) => void,
  onFileError: (message: string) => void,
) {
  try {
    // Copy the bytes before clearing the input. Chrome revokes the picked
    // file when value is reset, and a later arrayBuffer() call then fails.
    const file = await cloneSelectedFile(selected)
    input.value = ''
    onFile(file)
  } catch (error) {
    input.value = ''
    console.error('Failed to read the selected file', error)
    onFileError('The selected file could not be read. Try choosing it again.')
  }
}
