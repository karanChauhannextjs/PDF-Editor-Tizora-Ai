import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PageControlsProps = {
  currentPage: number
  pageCount: number
  disabled?: boolean
  onPageChange: (page: number) => void
}

export function PageControls({
  currentPage,
  pageCount,
  disabled,
  onPageChange,
}: PageControlsProps) {
  if (pageCount <= 1) {
    return null
  }

  return (
    <div
      className="flex items-center justify-center gap-2 py-2"
      aria-label="PDF page navigation"
      aria-busy={disabled ? true : undefined}
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || currentPage <= 1}
        aria-label="Previous page"
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft />
        Previous
      </Button>
      <p className="min-w-[7rem] text-center text-sm text-muted-foreground">
        Page{' '}
        <span className="font-medium text-foreground">{currentPage}</span> of{' '}
        <span className="font-medium text-foreground">{pageCount}</span>
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || currentPage >= pageCount}
        aria-label="Next page"
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
        <ChevronRight />
      </Button>
    </div>
  )
}
