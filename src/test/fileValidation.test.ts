import { describe, expect, it } from 'vitest'
import { validatePdfFile } from '@/utils/fileValidation'

describe('validatePdfFile', () => {
  it('rejects a file that is not a PDF', () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    expect(validatePdfFile(file)).toEqual({
      ok: false,
      message: 'Choose a PDF file. Other file types cannot be opened.',
    })
  })
})
