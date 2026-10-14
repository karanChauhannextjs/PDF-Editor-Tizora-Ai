import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { PdfPageDimensions } from '@/types/pdf'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type TextAnnotationEditorProps = {
  page: PdfPageDimensions
  x: number
  y: number
  initialText: string
  onCommit: (text: string) => void
  onCancel: () => void
}

export function TextAnnotationEditor({
  page,
  x,
  y,
  initialText,
  onCommit,
  onCancel,
}: TextAnnotationEditorProps) {
  const [value, setValue] = useState(initialText)
  const [error, setError] = useState<string | null>(null)

  const commit = () => {
    if (value.trim().length === 0) {
      setError('Enter some text before saving.')
      return
    }
    onCommit(value)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    commit()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      commit()
    }
  }

  return (
    <form
      className="absolute z-20 w-56 max-w-[80%] rounded-lg border bg-popover p-2 shadow-md"
      style={{
        left: `${(x / page.width) * 100}%`,
        top: `${(y / page.height) * 100}%`,
      }}
      onSubmit={handleSubmit}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <label
        className="mb-1 block text-xs font-medium"
        htmlFor="annotation-text"
      >
        Annotation text
      </label>
      <Textarea
        id="annotation-text"
        value={value}
        autoFocus
        onChange={(event) => {
          setValue(event.target.value)
          setError(null)
        }}
        onKeyDown={handleKeyDown}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  )
}
