import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { getDocument, RenderingCancelledException } from '@/lib/pdfjs'
import type { PdfPageDimensions } from '@/types/pdf'
import { cssWidthForPage } from '@/utils/coordinates'
import { hasPdfHeader, readFileBytes } from '@/utils/fileValidation'

export type PdfLoadResult = { ok: true } | { ok: false; message: string }

type ReadyPdf = {
  fileName: string
  page: PdfPageDimensions
  pageCount: number
  currentPageIndex: number
}

type CanvasRenderSnapshot = {
  canvas: HTMLCanvasElement
  page: PDFPageProxy
  requestId: number
}

export function usePdfDocument() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const documentRef = useRef<PDFDocumentProxy | null>(null)
  const pdfBytesRef = useRef<Uint8Array | null>(null)
  const pageRef = useRef<PDFPageProxy | null>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const canvasRenderSnapshotRef = useRef<CanvasRenderSnapshot | null>(null)
  const requestRef = useRef(0)
  const pageChangeInProgressRef = useRef(false)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [ready, setReady] = useState<ReadyPdf | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canvasNeedsRender = (
    canvas: HTMLCanvasElement,
    page: PDFPageProxy,
    requestId: number,
  ): boolean => {
    const snap = canvasRenderSnapshotRef.current
    if (!snap) {
      return true
    }
    return snap.canvas !== canvas || snap.page !== page || snap.requestId !== requestId
  }

  const recordCanvasRender = (canvas: HTMLCanvasElement, page: PDFPageProxy, requestId: number) => {
    canvasRenderSnapshotRef.current = { canvas, page, requestId }
  }

  const renderPage = useCallback(
    async (
      canvas: HTMLCanvasElement,
      page: PDFPageProxy,
      requestId: number,
    ): Promise<PdfLoadResult> => {
      const baseViewport = page.getViewport({ scale: 1 })
      const cssWidth = cssWidthForPage({
        width: baseViewport.width,
        height: baseViewport.height,
      })
      const viewport = page.getViewport({ scale: cssWidth / baseViewport.width })
      const pixelRatio = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * pixelRatio)
      canvas.height = Math.floor(viewport.height * pixelRatio)

      const context = canvas.getContext('2d')
      if (!context) {
        console.error('Canvas 2D context was unavailable while rendering a PDF page')
        return {
          ok: false,
          message: 'The browser could not prepare a surface for this PDF.',
        }
      }

      renderTaskRef.current?.cancel()
      const task = page.render({
        canvas: null,
        canvasContext: context,
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      })
      renderTaskRef.current = task

      try {
        await task.promise
        recordCanvasRender(canvas, page, requestId)
        return { ok: true }
      } catch (renderError) {
        if (
          renderError instanceof RenderingCancelledException ||
          requestId !== requestRef.current
        ) {
          return { ok: true }
        }
        console.error('Failed to render PDF page', renderError)
        return { ok: false, message: 'The PDF page could not be drawn.' }
      }
    },
    [],
  )

  const showPage = useCallback(
    async (
      pdf: PDFDocumentProxy,
      pageIndex: number,
      requestId: number,
      fileName: string,
    ): Promise<PdfLoadResult> => {
      const pdfPage = await pdf.getPage(pageIndex)
      if (requestId !== requestRef.current) {
        return { ok: false, message: 'The PDF load was cancelled.' }
      }
      const viewport = pdfPage.getViewport({ scale: 1 })
      if (requestId !== requestRef.current) {
        return { ok: false, message: 'The page change was cancelled.' }
      }
      pageRef.current = pdfPage
      setReady({
        fileName,
        page: { width: viewport.width, height: viewport.height },
        pageCount: pdf.numPages,
        currentPageIndex: pageIndex,
      })

      const canvas = canvasRef.current
      if (canvas && canvasNeedsRender(canvas, pdfPage, requestId)) {
        const rendered = await renderPage(canvas, pdfPage, requestId)
        if (!rendered.ok) {
          setPhase('ready')
          setError(rendered.message)
          return rendered
        }
      }
      if (requestId !== requestRef.current) {
        return { ok: false, message: 'The page change was cancelled.' }
      }
      setPhase('ready')
      return { ok: true }
    },
    [renderPage],
  )

  const handleCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node
      const page = pageRef.current
      if (!node || !page) {
        return
      }
      const requestId = requestRef.current
      if (!canvasNeedsRender(node, page, requestId)) {
        return
      }
      void renderPage(node, page, requestId).then((result) => {
        if (!result.ok && requestRef.current) {
          setError(result.message)
        }
      })
    },
    [renderPage],
  )

  const loadFromBytes = useCallback(
    async (bytes: Uint8Array, fileName: string, pageIndex = 1): Promise<PdfLoadResult> => {
      const requestId = requestRef.current + 1
      requestRef.current = requestId
      setPhase('loading')
      setError(null)

      try {
        if (requestId !== requestRef.current) {
          return { ok: false, message: 'The PDF load was cancelled.' }
        }
        if (!hasPdfHeader(bytes)) {
          setPhase(pageRef.current ? 'ready' : 'idle')
          const message = 'This file does not look like a valid PDF.'
          setError(message)
          return { ok: false, message }
        }

        const storedBytes = new Uint8Array(bytes.byteLength)
        storedBytes.set(bytes)
        pdfBytesRef.current = storedBytes
        const loadingTask = getDocument({ data: storedBytes.slice() })
        const pdf = await loadingTask.promise
        if (requestId !== requestRef.current) {
          await pdf.destroy()
          return { ok: false, message: 'The PDF load was cancelled.' }
        }

        const previous = documentRef.current
        documentRef.current = pdf
        if (previous && previous !== pdf) {
          renderTaskRef.current?.cancel()
          canvasRenderSnapshotRef.current = null
          await previous.destroy()
        }

        const safePageIndex = Math.min(Math.max(pageIndex, 1), pdf.numPages)
        const result = await showPage(pdf, safePageIndex, requestId, fileName)
        return result.ok ? { ok: true } : result
      } catch (loadError) {
        if (requestId !== requestRef.current) {
          return { ok: false, message: 'The PDF load was cancelled.' }
        }
        console.error('Failed to load PDF', loadError)
        setPhase(pageRef.current ? 'ready' : 'idle')
        const message = messageForPdfLoadError(loadError)
        setError(message)
        return { ok: false, message }
      }
    },
    [showPage],
  )

  const loadFile = async (file: File): Promise<PdfLoadResult> => {
    try {
      const bytes = await readFileBytes(file)
      return loadFromBytes(bytes, file.name, 1)
    } catch (loadError) {
      console.error('Failed to read PDF file', loadError)
      setPhase(pageRef.current ? 'ready' : 'idle')
      const message = 'The PDF file could not be read.'
      setError(message)
      return { ok: false, message }
    }
  }

  const goToPage = useCallback(
    async (pageIndex: number): Promise<PdfLoadResult> => {
      if (pageChangeInProgressRef.current) {
        return { ok: true }
      }
      const pdf = documentRef.current
      if (!pdf || !ready) {
        return { ok: false, message: 'No PDF is loaded.' }
      }
      if (pageIndex < 1 || pageIndex > pdf.numPages) {
        return { ok: false, message: 'That page does not exist.' }
      }
      if (pageIndex === ready.currentPageIndex) {
        return { ok: true }
      }

      pageChangeInProgressRef.current = true
      const requestId = requestRef.current + 1
      requestRef.current = requestId
      setPhase('loading')
      setError(null)
      try {
        const result = await showPage(pdf, pageIndex, requestId, ready.fileName)
        if (!result.ok && documentRef.current && pageRef.current) {
          setPhase('ready')
        }
        return result
      } finally {
        pageChangeInProgressRef.current = false
      }
    },
    [ready, showPage],
  )

  const unloadPdf = useCallback(() => {
    pageChangeInProgressRef.current = false
    requestRef.current += 1
    renderTaskRef.current?.cancel()
    canvasRenderSnapshotRef.current = null
    const document = documentRef.current
    documentRef.current = null
    pageRef.current = null
    pdfBytesRef.current = null
    if (document) {
      void document.destroy()
    }
    setReady(null)
    setPhase('idle')
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      unloadPdf()
    }
  }, [unloadPdf])

  return {
    phase,
    fileName: ready?.fileName ?? null,
    page: ready?.page ?? null,
    pageCount: ready?.pageCount ?? 0,
    currentPageIndex: ready?.currentPageIndex ?? 1,
    error,
    handleCanvasRef,
    loadFile,
    loadFromBytes,
    goToPage,
    getPdfBytes: () => {
      const bytes = pdfBytesRef.current
      if (!bytes || bytes.byteLength === 0) {
        return null
      }
      return bytes.slice()
    },
    clearError: () => setError(null),
    unloadPdf,
  }
}

function messageForPdfLoadError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'This PDF could not be opened. It may be damaged or password-protected.'
  }
  if (error.name === 'PasswordException') {
    return 'This PDF is password-protected. Choose a PDF that is not locked.'
  }
  if (error.name === 'InvalidPDFException') {
    return 'This file is not a valid PDF.'
  }
  if (error.message) {
    return `This PDF could not be opened. ${error.message}`
  }
  return 'This PDF could not be opened. It may be damaged or password-protected.'
}
