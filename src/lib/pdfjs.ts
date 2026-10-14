import {
  getDocument,
  GlobalWorkerOptions,
  RenderingCancelledException,
} from 'pdfjs-dist/legacy/build/pdf.mjs'

// The modern build calls Uint8Array.prototype.toHex / toBase64, which this
// browser does not provide. The legacy build polyfills those methods.
GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs?v=legacy`

export { getDocument, RenderingCancelledException }
