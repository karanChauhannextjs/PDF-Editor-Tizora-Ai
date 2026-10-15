import { PdfEditor } from '@/components/editor/PdfEditor'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App() {
  return (
    <TooltipProvider delay={300}>
      <PdfEditor />
      <Toaster />
    </TooltipProvider>
  )
}
