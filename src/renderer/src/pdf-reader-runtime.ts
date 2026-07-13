import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist"
import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { EventBus, PDFViewer, ScrollMode, SpreadMode } from "pdfjs-dist/web/pdf_viewer.mjs"

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

export type PDFScalePreset = "page-fit" | "page-height" | "page-width"
export type PDFPageLayout = "vertical" | "horizontal"
export type PDFPageView = "single" | "double"

export const MIN_PDF_SCALE = 0.25
export const MAX_PDF_SCALE = 5
const PINCH_RENDER_DELAY = 400
const FIT_VISIBILITY_MARGIN = 1

type PDFScale = number | PDFScalePreset

type PDFReaderRuntimeOptions = {
  readonly document: OpenedDocument
  readonly container: HTMLDivElement
  readonly viewer: HTMLDivElement
  readonly onPageChange: (pageNumber: number) => void
  readonly onPageCountChange: (pageCount: number) => void
  readonly onScaleChange: (scale: number) => void
  readonly onPinchZoom: (scale: number) => void
  readonly onStatusChange: (status: PDFReaderStatus) => void
}

export function createPDFReaderRuntime({
  document,
  container,
  viewer,
  onPageChange,
  onPageCountChange,
  onScaleChange,
  onPinchZoom,
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
  let requestedPageLayout: PDFPageLayout = "vertical"
  let requestedPageView: PDFPageView = "single"
  let requestedScale: PDFScale = 1
  let pendingPinchFactor = 1
  let pinchDirection = 0
  let isCtrlKeyDown = false

  const fitRequestedSpread = () => {
    if (
      !pdfViewer ||
      requestedPageView !== "double" ||
      (requestedScale !== "page-fit" && requestedScale !== "page-width")
    ) {
      return
    }

    const requestedPageElement = viewer.querySelector<HTMLElement>(
      `.page[data-page-number="${requestedPage}"]`,
    )
    const spread = requestedPageElement?.closest<HTMLElement>(".spread")
    if (!spread) return

    const pageBounds = [...spread.querySelectorAll<HTMLElement>(".page")].map((page) =>
      page.getBoundingClientRect(),
    )
    if (pageBounds.length === 0) return

    const occupiedWidth =
      Math.max(...pageBounds.map(({ right }) => right)) -
      Math.min(...pageBounds.map(({ left }) => left))
    const pageWidth = pageBounds.reduce((width, bounds) => width + bounds.width, 0)
    const fixedGap = Math.max(0, occupiedWidth - pageWidth)
    const unscaledSpreadWidth = pageWidth / pdfViewer.currentScale
    const unscaledSpreadHeight =
      Math.max(...pageBounds.map(({ height }) => height)) / pdfViewer.currentScale
    const viewerStyle = getComputedStyle(viewer)
    const verticalPadding =
      Number.parseFloat(viewerStyle.paddingTop) + Number.parseFloat(viewerStyle.paddingBottom)
    const widthScale =
      (container.clientWidth - fixedGap - FIT_VISIBILITY_MARGIN) / unscaledSpreadWidth
    const heightScale =
      (container.clientHeight - verticalPadding - FIT_VISIBILITY_MARGIN) /
      unscaledSpreadHeight
    const spreadScale =
      requestedScale === "page-width" ? widthScale : Math.min(widthScale, heightScale)
    if (!Number.isFinite(spreadScale) || spreadScale <= 0) return

    const cappedScale = Math.min(MAX_PDF_SCALE, spreadScale)
    if (Math.abs(pdfViewer.currentScale - cappedScale) > 0.001) {
      pdfViewer.currentScale = cappedScale
    }
  }

  const applyRequestedScale = () => {
    if (!pdfViewer) return

    if (typeof requestedScale === "number") {
      pdfViewer.currentScale = requestedScale
    } else {
      pdfViewer.currentScaleValue = requestedScale
      const boundedScale = Math.min(
        MAX_PDF_SCALE,
        Math.max(MIN_PDF_SCALE, pdfViewer.currentScale),
      )
      if (pdfViewer.currentScale !== boundedScale) {
        pdfViewer.currentScale = boundedScale
      }
      fitRequestedSpread()
    }
  }

  const applyRequestedLayout = () => {
    if (!pdfViewer) return

    const anchoredPage = requestedPage
    pdfViewer.scrollMode =
      requestedPageLayout === "horizontal" ? ScrollMode.HORIZONTAL : ScrollMode.VERTICAL
    pdfViewer.spreadMode =
      requestedPageView === "double" ? SpreadMode.ODD : SpreadMode.NONE
    applyRequestedScale()
    if (pdfViewer.currentPageNumber !== anchoredPage) {
      pdfViewer.currentPageNumber = anchoredPage
    }
  }
  const handlePageChange = ({ pageNumber }: { pageNumber: number }) => {
    const keepsRequestedPageVisible =
      requestedPageView === "double" &&
      Math.floor((pageNumber - 1) / 2) === Math.floor((requestedPage - 1) / 2)
    if (pageNumber !== requestedPage && keepsRequestedPageVisible) return

    requestedPage = pageNumber
    onPageChange(pageNumber)
  }
  const handlePagesInit = () => {
    applyRequestedLayout()
    onStatusChange({ state: "ready" })
  }
  const handleScaleChange = ({ scale }: { scale: number }) => onScaleChange(scale)
  const handlePageRendered = () => {
    fitRequestedSpread()
  }
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Control") isCtrlKeyDown = true
  }
  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === "Control") isCtrlKeyDown = false
  }
  const handleWheel = (event: WheelEvent) => {
    if (!pdfViewer?.pagesCount) return

    // Chromium represents a trackpad pinch as a pixel-based Ctrl+wheel gesture.
    // Keep the same conservative shape check used by the pdf.js viewer so a
    // regular horizontal or coarse mouse-wheel scroll remains a scroll.
    const deltaMode = event.deltaMode
    const scaleFactor = Math.exp(-event.deltaY / 100)
    const isTrackpadPinch =
      event.ctrlKey &&
      !isCtrlKeyDown &&
      deltaMode === WheelEvent.DOM_DELTA_PIXEL &&
      event.deltaX === 0 &&
      Math.abs(scaleFactor - 1) < 0.05 &&
      event.deltaZ === 0

    if (!isTrackpadPinch) return

    event.preventDefault()
    const direction = Math.sign(scaleFactor - 1)
    if (direction !== pinchDirection) {
      pendingPinchFactor = 1
      pinchDirection = direction
    }
    pendingPinchFactor *= scaleFactor
    const unboundedScale = pdfViewer.currentScale * pendingPinchFactor
    const nextScale = Math.min(
      MAX_PDF_SCALE,
      Math.max(
        MIN_PDF_SCALE,
        direction > 0
          ? Math.floor(unboundedScale * 100) / 100
          : Math.ceil(unboundedScale * 100) / 100,
      ),
    )
    if (nextScale === pdfViewer.currentScale) return

    pendingPinchFactor = unboundedScale / nextScale
    requestedScale = nextScale
    pdfViewer.updateScale({
      drawingDelay: PINCH_RENDER_DELAY,
      scaleFactor: nextScale / pdfViewer.currentScale,
      origin: [event.clientX, event.clientY],
    })
    onPinchZoom(nextScale)
  }
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
  container.addEventListener("wheel", handleWheel, {
    passive: false,
    signal: abortController.signal,
  })
  window.addEventListener("keydown", handleKeyDown, { signal: abortController.signal })
  window.addEventListener("keyup", handleKeyUp, { signal: abortController.signal })
  window.addEventListener("blur", () => (isCtrlKeyDown = false), {
    signal: abortController.signal,
  })
  void loadingTask.promise
    .then((loadedDocument) => {
      if (destroyed) return

      eventBus = new EventBus()
      const viewerOptions = {
        abortSignal: abortController.signal,
        container,
        eventBus,
        removePageBorders: true,
        viewer,
      }
      pdfViewer = new PDFViewer(viewerOptions)
      eventBus.on("pagesinit", handlePagesInit)
      eventBus.on("pagechanging", handlePageChange)
      eventBus.on("pagerendered", handlePageRendered)
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
      eventBus?.off("pagerendered", handlePageRendered)
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
    setPageLayout: (pageLayout: PDFPageLayout) => {
      requestedPageLayout = pageLayout
      if (pdfViewer?.pagesCount) applyRequestedLayout()
    },
    setPageView: (pageView: PDFPageView) => {
      requestedPageView = pageView
      if (pdfViewer?.pagesCount) applyRequestedLayout()
    },
  }
}

export type PDFReaderRuntime = ReturnType<typeof createPDFReaderRuntime>
