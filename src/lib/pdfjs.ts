import {
  getDocument,
  GlobalWorkerOptions,
  RenderingCancelledException,
} from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

// The modern build calls Uint8Array.prototype.toHex / toBase64, which this
// browser does not provide. The legacy build polyfills those methods.
GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export { getDocument, RenderingCancelledException }
