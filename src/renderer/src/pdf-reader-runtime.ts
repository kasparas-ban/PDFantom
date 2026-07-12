import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist"
import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { EventBus, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs"

import type { OpenedDocument } from "../../shared/document-api"

declare module "pdfjs-dist/web/pdf_viewer.mjs" {
  // eslint-disable-next-line typescript/consistent-type-definitions -- Declaration merging requires an interface.
  interface PDFViewer {
    setDocument(pdfDocument: PDFDocumentProxy | null): void
  }
}

GlobalWorkerOptions.workerSrc = workerSource

export type PDFReaderStatus =
  | { state: "opening" }
  | { state: "ready" }
  | { state: "failed"; message: string }

type PDFReaderRuntimeOptions = {
  readonly document: OpenedDocument
  readonly container: HTMLDivElement
  readonly viewer: HTMLDivElement
  readonly onPageChange: (pageNumber: number) => void
  readonly onPageCountChange: (pageCount: number) => void
  readonly onStatusChange: (status: PDFReaderStatus) => void
}

export function createPDFReaderRuntime({
  document,
  container,
  viewer,
  onPageChange,
  onPageCountChange,
  onStatusChange,
}: PDFReaderRuntimeOptions) {
  const abortController = new AbortController()
  const loadingTask = getDocument({
    data: document.bytes.slice(0),
    useWorkerFetch: false,
  })

  let destroyed = false
  let eventBus: EventBus | null = null
  let pdfViewer: PDFViewer | null = null
  let requestedPage = 1
  let requestedZoom = 1

  const applyRequestedView = () => {
    if (!pdfViewer) return

    pdfViewer.currentScale = requestedZoom
    if (pdfViewer.currentPageNumber !== requestedPage) {
      pdfViewer.currentPageNumber = requestedPage
    }
  }
  const handlePageChange = ({ pageNumber }: { pageNumber: number }) => {
    requestedPage = pageNumber
    onPageChange(pageNumber)
  }
  const handlePagesInit = () => {
    applyRequestedView()
    onStatusChange({ state: "ready" })
  }
  const reportFailure = () => {
    if (!destroyed) {
      onStatusChange({ state: "failed", message: "This PDF could not be opened." })
    }
  }

  onStatusChange({ state: "opening" })
  void loadingTask.promise
    .then((loadedDocument) => {
      if (destroyed) return

      eventBus = new EventBus()
      const viewerOptions = {
        abortSignal: abortController.signal,
        container,
        eventBus,
        viewer,
      }
      pdfViewer = new PDFViewer(viewerOptions)
      eventBus.on("pagesinit", handlePagesInit)
      eventBus.on("pagechanging", handlePageChange)
      onPageCountChange(loadedDocument.numPages)
      pdfViewer.setDocument(loadedDocument)
    })
    .catch(reportFailure)

  return {
    destroy: () => {
      destroyed = true
      eventBus?.off("pagesinit", handlePagesInit)
      eventBus?.off("pagechanging", handlePageChange)
      pdfViewer?.setDocument(null)
      abortController.abort()
      pdfViewer?.cleanup()
      void loadingTask.destroy()
    },
    goToPage: (pageNumber: number) => {
      requestedPage = pageNumber
      if (pdfViewer?.pagesCount && pdfViewer.currentPageNumber !== pageNumber) {
        pdfViewer.currentPageNumber = pageNumber
      }
    },
    setZoom: (zoom: number) => {
      requestedZoom = zoom
      if (pdfViewer?.pagesCount) pdfViewer.currentScale = zoom
    },
  }
}

export type PDFReaderRuntime = ReturnType<typeof createPDFReaderRuntime>
