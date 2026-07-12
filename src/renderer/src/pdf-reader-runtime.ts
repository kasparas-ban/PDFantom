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

export type PDFScalePreset = "page-fit" | "page-width"

type PDFScale = number | PDFScalePreset

type PDFReaderRuntimeOptions = {
  readonly document: OpenedDocument
  readonly container: HTMLDivElement
  readonly viewer: HTMLDivElement
  readonly onPageChange: (pageNumber: number) => void
  readonly onPageCountChange: (pageCount: number) => void
  readonly onScaleChange: (scale: number) => void
  readonly onStatusChange: (status: PDFReaderStatus) => void
}

export function createPDFReaderRuntime({
  document,
  container,
  viewer,
  onPageChange,
  onPageCountChange,
  onScaleChange,
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
  let requestedScale: PDFScale = 1

  const applyRequestedScale = () => {
    if (!pdfViewer) return

    if (typeof requestedScale === "number") {
      pdfViewer.currentScale = requestedScale
    } else {
      pdfViewer.currentScaleValue = requestedScale
    }
  }

  const applyRequestedView = () => {
    if (!pdfViewer) return

    applyRequestedScale()
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
  const handleScaleChange = ({ scale }: { scale: number }) => onScaleChange(scale)
  const reportFailure = () => {
    if (!destroyed) {
      onStatusChange({ state: "failed", message: "This PDF could not be opened." })
    }
  }
  const resizeObserver = new ResizeObserver(() => {
    if (typeof requestedScale !== "string" || !pdfViewer?.pagesCount) return

    applyRequestedScale()
    pdfViewer.update()
  })

  onStatusChange({ state: "opening" })
  resizeObserver.observe(container)
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
      eventBus.on("scalechanging", handleScaleChange)
      onPageCountChange(loadedDocument.numPages)
      pdfViewer.setDocument(loadedDocument)
    })
    .catch(reportFailure)

  return {
    destroy: () => {
      destroyed = true
      eventBus?.off("pagesinit", handlePagesInit)
      eventBus?.off("pagechanging", handlePageChange)
      eventBus?.off("scalechanging", handleScaleChange)
      pdfViewer?.setDocument(null)
      abortController.abort()
      resizeObserver.disconnect()
      pdfViewer?.cleanup()
      void loadingTask.destroy()
    },
    goToPage: (pageNumber: number) => {
      requestedPage = pageNumber
      if (pdfViewer?.pagesCount && pdfViewer.currentPageNumber !== pageNumber) {
        pdfViewer.currentPageNumber = pageNumber
      }
    },
    setScale: (scale: PDFScale) => {
      requestedScale = scale
      if (pdfViewer?.pagesCount) applyRequestedScale()
    },
  }
}

export type PDFReaderRuntime = ReturnType<typeof createPDFReaderRuntime>
