import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PendingAction } from '@/components/editor/pdfEditor/types'

type PdfEditorPendingDialogProps = {
  pending: PendingAction | null
  onClose: () => void
  onConfirm: () => void
}

export function PdfEditorPendingDialog({
  pending,
  onClose,
  onConfirm,
}: PdfEditorPendingDialogProps) {
  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {pending?.kind === 'import'
              ? 'Replace annotations?'
              : 'Open a different PDF?'}
          </DialogTitle>
          <DialogDescription>
            {pending?.kind === 'import'
              ? 'Importing replaces every annotation in this document.'
              : 'If the PDF opens, all annotations are cleared. Export them first if you want to keep them.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
