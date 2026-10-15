import { FileControls } from '@/components/editor/FileControls'
import { PdfEditorLogo } from '@/components/editor/pdfEditor/PdfEditorLogo'

type PdfEditorHeaderProps = {
  canImport: boolean
  canExport: boolean
  canDownloadPdf: boolean
  isLoading: boolean
  isDownloadingPdf: boolean
  canResetAnnotations: boolean
  canRemovePdf: boolean
  onOpenPdf: (file: File) => void
  onImportAnnotations: (file: File) => void
  onExportAnnotations: () => void
  onDownloadPdf: () => void
  onResetAnnotations: () => void
  onRemovePdf: () => void
  onFileError: (message: string) => void
}

export function PdfEditorHeader({
  canImport,
  canExport,
  canDownloadPdf,
  isLoading,
  isDownloadingPdf,
  canResetAnnotations,
  canRemovePdf,
  onOpenPdf,
  onImportAnnotations,
  onExportAnnotations,
  onDownloadPdf,
  onResetAnnotations,
  onRemovePdf,
  onFileError,
}: PdfEditorHeaderProps) {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b bg-background px-4 py-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <PdfEditorLogo className="min-w-0 shrink-0" />
      <div className="min-w-0 max-md:-mx-4 max-md:px-4">
        <FileControls
          canImport={canImport}
          canExport={canExport}
          canDownloadPdf={canDownloadPdf}
          isLoading={isLoading}
          isDownloadingPdf={isDownloadingPdf}
          onOpenPdf={onOpenPdf}
          onImportAnnotations={onImportAnnotations}
          onExportAnnotations={onExportAnnotations}
          onDownloadPdf={onDownloadPdf}
          canResetAnnotations={canResetAnnotations}
          onResetAnnotations={onResetAnnotations}
          canRemovePdf={canRemovePdf}
          onRemovePdf={onRemovePdf}
          onFileError={onFileError}
        />
      </div>
    </header>
  )
}
