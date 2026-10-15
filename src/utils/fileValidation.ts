export type FileValidationResult = { ok: true } | { ok: false; message: string }

export function validatePdfFile(file: File): FileValidationResult {
  if (file.size <= 0) {
    return { ok: false, message: 'The selected PDF is empty.' }
  }

  const isPdfName = file.name.toLowerCase().endsWith('.pdf')
  const isPdfType = file.type === 'application/pdf' || file.type === 'application/x-pdf'
  if (!isPdfName && !isPdfType) {
    return {
      ok: false,
      message: 'Choose a PDF file. Other file types cannot be opened.',
    }
  }

  return { ok: true }
}

export function validateJsonFile(file: File): FileValidationResult {
  if (file.size <= 0) {
    return { ok: false, message: 'The selected annotation file is empty.' }
  }

  const isJsonName = file.name.toLowerCase().endsWith('.json')
  const isJsonType =
    file.type === 'application/json' || file.type === 'text/json' || file.type === ''
  if (!isJsonName && !isJsonType) {
    return {
      ok: false,
      message: 'Choose a JSON annotation file exported from this editor.',
    }
  }

  return { ok: true }
}

export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer())
  }

  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
        return
      }
      reject(new Error('FileReader did not return binary data'))
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('FileReader failed'))
    }
    reader.readAsArrayBuffer(file)
  })
  return new Uint8Array(buffer)
}

export async function cloneSelectedFile(file: File): Promise<File> {
  const bytes = await readFileBytes(file)
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new File([copy], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  })
}

export function hasPdfHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  )
}
