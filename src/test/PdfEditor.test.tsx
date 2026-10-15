import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PdfEditor } from '@/components/editor/PdfEditor'

vi.mock('@/lib/pdfjs', () => ({
  getDocument: vi.fn(),
  RenderingCancelledException: class RenderingCancelledException extends Error {},
}))

function renderEditor() {
  render(<PdfEditor initialPage={{ width: 600, height: 800 }} />)
  const svg = screen.getByTestId('annotation-svg')
  svg.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 600,
      bottom: 800,
      width: 600,
      height: 800,
      toJSON() {
        return {}
      },
    }) as DOMRect
}

describe('PdfEditor', () => {
  it('creates a text annotation from the Text tool', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.pointerDown(screen.getByTestId('annotation-svg'), {
      button: 0,
      pointerId: 1,
      clientX: 40,
      clientY: 50,
    })

    const field = await screen.findByLabelText('Annotation text')
    await user.type(field, 'Hello note')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      within(screen.getByTestId('annotation-svg')).getByText('Hello note'),
    ).toBeInTheDocument()
  })

  it('does not delete an annotation while text is being edited', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.pointerDown(screen.getByTestId('annotation-svg'), {
      button: 0,
      pointerId: 1,
      clientX: 40,
      clientY: 50,
    })
    await user.type(
      await screen.findByLabelText('Annotation text'),
      'Hello note',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.pointerDown(
      within(screen.getByTestId('annotation-svg')).getByText('Hello note'),
      {
        button: 0,
        pointerId: 1,
        clientX: 40,
        clientY: 50,
      },
    )
    await user.click(screen.getByRole('button', { name: 'Edit text' }))

    const field = screen.getByLabelText('Annotation text')
    await user.type(field, '{Backspace}')
    expect(screen.getByLabelText('Annotation text')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      within(screen.getByTestId('annotation-svg')).getByText('Hello note'),
    ).toBeInTheDocument()
  })

  it('undoes the last annotation change from the toolbar', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.pointerDown(screen.getByTestId('annotation-svg'), {
      button: 0,
      pointerId: 1,
      clientX: 40,
      clientY: 50,
    })
    await user.type(
      await screen.findByLabelText('Annotation text'),
      'Undo me',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      within(screen.getByTestId('annotation-svg')).getByText('Undo me'),
    ).toBeInTheDocument()

    const undoButton = screen.getByRole('button', { name: 'Undo' })
    expect(undoButton).toBeEnabled()
    await user.click(undoButton)

    expect(
      within(screen.getByTestId('annotation-svg')).queryByText('Undo me'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled()
  })

  it('shows a friendly error when the chosen file is not a PDF', async () => {
    const user = userEvent.setup()
    render(<PdfEditor />)

    const input = screen.getAllByLabelText('Open PDF')[0]
    const file = new File(['hello'], 'notes.pdf', { type: 'application/pdf' })
    await user.upload(input, file)

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid PDF/i)
  })
})
