import { PdfEditor } from '@/components/editor/PdfEditor'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App() {
  return (
    <TooltipProvider delay={300}>
      <PdfEditor />
    </TooltipProvider>
  )
}
