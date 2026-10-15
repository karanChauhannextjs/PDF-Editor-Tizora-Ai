import { cn } from '@/lib/utils'

const LOGO_SRC = `${import.meta.env.BASE_URL}pdf-editor-logo.png`

type PdfEditorLogoProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
}

const sizeClass = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
} as const

export function PdfEditorLogo({ className, size = 'md', showWordmark = true }: PdfEditorLogoProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <img
        src={LOGO_SRC}
        alt=""
        className={cn('shrink-0 object-contain', sizeClass[size])}
        width={48}
        height={48}
        decoding="async"
      />
      {showWordmark ? (
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-lg font-semibold tracking-tight">PDF Editor</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Annotate a PDF page, export JSON, or download an annotated PDF.
          </p>
        </div>
      ) : null}
    </div>
  )
}
