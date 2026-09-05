import { getDocument, GlobalWorkerOptions, PDFWorker, type PDFDocumentProxy } from "pdfjs-dist"
import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import {
  EventBus,
  PDFViewer,
  RenderingStates,
  ScrollMode,
  SpreadMode,
  type PDFPageView as PDFPage,
} from "pdfjs-dist/web/pdf_viewer.mjs"

import type { OpenedDocument } from "../../../shared/document-api"
import { installPDFRenderingGate } from "./pdf-rendering-gate"
import {
  DEFAULT_READER_VIEW,
  MAX_PDF_SCALE,
  MIN_PDF_SCALE,
  type PDFPageLayout,
  type PDFPageView,
  type PDFScalePreset,
  type ReadingPosition,
} from "./reader-model"

declare module "pdfjs-dist/web/pdf_viewer.mjs" {
  // eslint-disable-next-line typescript/consistent-type-definitions -- Declaration merging requires an interface.
  interface PDFViewer {
    setDocument(pdfDocument: PDFDocumentProxy | null): void
  }
}

GlobalWorkerOptions.workerSrc = workerSource

export type PDFReaderStatus =
  | { state: "opening" }
  | { state: "ready"; interactive: boolean }
  | { state: "failed"; message: string }

const PINCH_RENDER_DELAY = 400
const FIT_VISIBILITY_MARGIN = 1

type PDFScale = number | PDFScalePreset

type PDFReaderRuntimeOptions = {
  readonly initialLifecycle?: "inactive" | "preparing"
  readonly worker: PDFWorker
  readonly document: OpenedDocument
  readonly container: HTMLDivElement
  readonly viewer: HTMLDivElement
  readonly initialReadingPosition: ReadingPosition | null
  readonly onReadingPositionChange: (position: ReadingPosition) => void
  readonly onPageChange: (pageNumber: number) => void
  readonly onPageCountChange: (pageCount: number) => void
  readonly onScaleChange: (scale: number) => void
  readonly onPinchZoom: (scale: number) => void
  readonly onStatusChange: (status: PDFReaderStatus) => void
  readonly onSettled: () => void
}

export const createReaderWorker = () => new PDFWorker()

export function createPDFReaderRuntime({
  document,
  initialLifecycle = "preparing",
  container,
  viewer,
  initialReadingPosition,
  onReadingPositionChange,
  onPageChange,
  onPageCountChange,
  onScaleChange,
  onPinchZoom,
  onStatusChange,
  onSettled,
  worker,
}: PDFReaderRuntimeOptions) {
  const documentId = document.id
  const abortController = new AbortController()
  const loadingTask = getDocument({
    data: document.bytes.slice(0),
    useWorkerFetch: false,
    worker,
  })

  let destroyed = false
  let ready = false
  let loadedDocument: PDFDocumentProxy | null = null
  let pendingPagesInit = false
  let pendingPagesLoaded = false
  let reconcileInitialPosition = false
  let lifecycle: "presented" | "preparing" | "inactive" = initialLifecycle
  let revision = 0
  let frame = 0
  let settledTimer = 0
  let selection: Range | null = null
  const drawn = new Map<number, number>()
  const details = new Map<number, { scale: number; canvas: HTMLCanvasElement }>()
  const textDrawn = new Map<number, number>()
  let eventBus: EventBus | null = null
  let pdfViewer: PDFViewer | null = null
  let renderingGate: ReturnType<typeof installPDFRenderingGate> | null = null
  let requestedPage = 1
  let requestedPageLayout: PDFPageLayout = DEFAULT_READER_VIEW.pageLayout
  let requestedPageView: PDFPageView = DEFAULT_READER_VIEW.pageView
  let requestedScale: PDFScale = DEFAULT_READER_VIEW.scalePreset
  let pendingPinchFactor = 1
  let pinchDirection = 0
  let isCtrlKeyDown = false

  const savePosition = () => {
    if (
      !ready ||
      lifecycle !== "presented" ||
      !pdfViewer ||
      !container.clientWidth ||
      !container.clientHeight
    ) {
      return
    }

    const page = viewer.querySelector<HTMLElement>(`.page[data-page-number="${requestedPage}"]`)
    if (!page) return

    const pageBounds = page.getBoundingClientRect()
    const containerBounds = container.getBoundingClientRect()
    onReadingPositionChange({
      pageNumber: requestedPage,
      offsetX: (containerBounds.left - pageBounds.left) / pdfViewer.currentScale,
      offsetY: (containerBounds.top - pageBounds.top) / pdfViewer.currentScale,
      zoom: pdfViewer.currentScale,
      scalePreset: typeof requestedScale === "string" ? requestedScale : null,
      pageLayout: requestedPageLayout,
      pageView: requestedPageView,
    })
  }

  const flushPosition = () => {
    if (!ready || lifecycle !== "presented") return
    pdfViewer?.update()
    savePosition()
  }

  const viewportReadiness = () => {
    if (
      !ready ||
      destroyed ||
      lifecycle === "inactive" ||
      !pdfViewer ||
      !container.clientWidth ||
      !container.clientHeight
    ) {
      return null
    }

    const bounds = container.getBoundingClientRect()
    const pages = [...viewer.querySelectorAll<HTMLElement>(".page")].filter((page) => {
      const rect = page.getBoundingClientRect()
      return (
        rect.bottom > bounds.top &&
        rect.top < bounds.bottom &&
        rect.right > bounds.left &&
        rect.left < bounds.right
      )
    })
    if (!pages.length) return null

    let interactive = true

    for (const page of pages) {
      const number = Number(page.dataset.pageNumber)
      const view: PDFPage = pdfViewer.getPageView(number - 1)

      if (
        !view ||
        view.renderingState !== RenderingStates.FINISHED ||
        Math.abs(view.scale - pdfViewer.currentScale) > 0.0001
      ) {
        return null
      }
      if (view.detailView && view.detailView.renderingState !== RenderingStates.FINISHED) {
        return null
      }

      if (drawn.get(number) !== view.scale) {
        const detail = details.get(number)

        if (!detail || detail.scale !== view.scale || detail.canvas !== view.detailView?.canvas) {
          return null
        }

        const raster = detail.canvas.getBoundingClientRect()
        const pageBounds = page.getBoundingClientRect()

        if (
          raster.left > Math.max(pageBounds.left, bounds.left) ||
          raster.top > Math.max(pageBounds.top, bounds.top) ||
          raster.right < Math.min(pageBounds.right, bounds.right) ||
          raster.bottom < Math.min(pageBounds.bottom, bounds.bottom)
        ) {
          return null
        }
      }

      interactive &&= textDrawn.get(number) === view.scale
    }

    return { interactive }
  }

  const scheduleReadiness = () => {
    const currentRevision = ++revision
    cancelAnimationFrame(frame)
    clearTimeout(settledTimer)
    frame = requestAnimationFrame(() => {
      if (currentRevision !== revision) return

      const viewport = viewportReadiness()
      if (!viewport) return

      onStatusChange({ state: "ready", ...viewport })

      settledTimer = window.setTimeout(() => {
        if (revision === currentRevision && viewportReadiness()) {
          flushPosition()
          onSettled()
        }
      }, 200)
    })
  }

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
      (container.clientHeight - verticalPadding - FIT_VISIBILITY_MARGIN) / unscaledSpreadHeight
    const spreadScale =
      requestedScale === "page-width" ? widthScale : Math.min(widthScale, heightScale)
    if (!Number.isFinite(spreadScale) || spreadScale <= 0) return

    const cappedScale = Math.min(MAX_PDF_SCALE, spreadScale)
    if (Math.abs(pdfViewer.currentScale - cappedScale) > 0.001) {
      const anchoredPage = requestedPage
      pdfViewer.currentScale = cappedScale
      // PDF.js scaling restores its last scroll location, which can still
      // belong to the previous spread when navigation and rendering overlap.
      if (pdfViewer.currentPageNumber !== anchoredPage) pdfViewer.currentPageNumber = anchoredPage
    }
  }

  const applyRequestedScale = () => {
    if (!pdfViewer) return

    if (typeof requestedScale === "number") {
      pdfViewer.currentScale = requestedScale
    } else {
      pdfViewer.currentScaleValue = requestedScale
      const boundedScale = Math.min(MAX_PDF_SCALE, Math.max(MIN_PDF_SCALE, pdfViewer.currentScale))
      if (pdfViewer.currentScale !== boundedScale) pdfViewer.currentScale = boundedScale
      fitRequestedSpread()
    }
  }

  const applyRequestedLayout = () => {
    if (!pdfViewer) return

    const anchoredPage = requestedPage
    pdfViewer.scrollMode =
      requestedPageLayout === "horizontal" ? ScrollMode.HORIZONTAL : ScrollMode.VERTICAL
    pdfViewer.spreadMode = requestedPageView === "double" ? SpreadMode.ODD : SpreadMode.NONE
    applyRequestedScale()
    if (pdfViewer.currentPageNumber !== anchoredPage) pdfViewer.currentPageNumber = anchoredPage
  }

  const handlePageChange = ({ pageNumber }: { pageNumber: number }) => {
    if (!ready || lifecycle === "inactive") return

    const keepsRequestedPageVisible =
      requestedPageView === "double" &&
      Math.floor((pageNumber - 1) / 2) === Math.floor((requestedPage - 1) / 2)
    if (pageNumber !== requestedPage && keepsRequestedPageVisible) return

    requestedPage = pageNumber
    if (!destroyed) onPageChange(pageNumber)
  }

  const handlePagesInit = () => {
    pendingPagesInit = lifecycle === "inactive"
    if (!pdfViewer || pendingPagesInit) return

    requestedPage = Math.min(requestedPage, pdfViewer.pagesCount)
    applyRequestedLayout()

    // PDF.js installs a global copy handler, but it only handles selections
    // containing this element. Inert viewers cannot contribute to selection.
    const copy = container.querySelector<HTMLElement>("#hiddenCopyElement")
    if (copy) copy.id = `reader-copy-${documentId}`

    if (!initialReadingPosition) {
      ready = true
      pdfViewer.update()
      scheduleReadiness()
    }
  }

  const handlePagesLoaded = () => {
    pendingPagesLoaded = lifecycle === "inactive"
    if (destroyed || !pdfViewer || !initialReadingPosition || pendingPagesLoaded) return

    applyRequestedLayout()

    const page = viewer.querySelector<HTMLElement>(`.page[data-page-number="${requestedPage}"]`)

    if (page) {
      // Retain the saved scale for mixed-size pages unless the host changed
      // during loading. A fit preference only recalculates for new geometry.
      if (!reconcileInitialPosition || !initialReadingPosition.scalePreset) {
        pdfViewer.currentScale = initialReadingPosition.zoom
      }

      const pageBounds = page.getBoundingClientRect()
      const containerBounds = container.getBoundingClientRect()

      container.scrollLeft +=
        pageBounds.left -
        containerBounds.left +
        initialReadingPosition.offsetX * pdfViewer.currentScale
      container.scrollTop +=
        pageBounds.top -
        containerBounds.top +
        initialReadingPosition.offsetY * pdfViewer.currentScale
    }

    ready = true
    onPageChange(requestedPage)
    pdfViewer.update()
    scheduleReadiness()
  }

  const handleScaleChange = ({ scale }: { scale: number }) => {
    if (destroyed || lifecycle === "inactive") return

    onScaleChange(scale)
    scheduleReadiness()
  }

  const handlePageRendered = ({
    pageNumber,
    source,
    error,
    cssTransform,
    isDetailView,
  }: {
    pageNumber: number
    source: PDFPage
    error?: unknown
    cssTransform?: boolean
    isDetailView?: boolean
  }) => {
    if (destroyed || lifecycle === "inactive") return

    if (error) {
      reportFailure()
      return
    }

    if (!cssTransform && !isDetailView) drawn.set(pageNumber, source.scale)

    if (isDetailView && pdfViewer) {
      const page: PDFPage = pdfViewer.getPageView(pageNumber - 1)

      if (page.detailView === source && source.canvas) {
        details.set(pageNumber, { scale: page.scale, canvas: source.canvas })
      }
    }

    fitRequestedSpread()
    scheduleReadiness()
  }

  const handleTextRendered = ({ pageNumber, source }: { pageNumber: number; source: PDFPage }) => {
    if (destroyed) return

    textDrawn.set(pageNumber, source.scale)
    scheduleReadiness()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (lifecycle !== "presented") return

    if (event.key === "Control") isCtrlKeyDown = true
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === "Control") isCtrlKeyDown = false
  }

  const handleWheel = (event: WheelEvent) => {
    if (lifecycle !== "presented" || !pdfViewer?.pagesCount) return

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
    if (!destroyed) onStatusChange({ state: "failed", message: "This PDF could not be opened." })
  }

  const resizeObserver = new ResizeObserver(() => {
    if (
      !container.clientWidth ||
      !container.clientHeight ||
      lifecycle === "inactive" ||
      typeof requestedScale !== "string" ||
      !pdfViewer?.pagesCount
    ) {
      return
    }

    applyRequestedScale()
    pdfViewer.update()
    scheduleReadiness()
  })

  onStatusChange({ state: "opening" })
  resizeObserver.observe(container)
  container.addEventListener("wheel", handleWheel, {
    passive: false,
    signal: abortController.signal,
  })
  container.addEventListener("scroll", scheduleReadiness, { signal: abortController.signal })
  window.addEventListener("beforeunload", flushPosition, { signal: abortController.signal })
  window.addEventListener("keydown", handleKeyDown, { signal: abortController.signal })
  window.addEventListener("keyup", handleKeyUp, { signal: abortController.signal })
  window.addEventListener("blur", () => (isCtrlKeyDown = false), {
    signal: abortController.signal,
  })
  // Parsing may finish in the background; PDFViewer needs a measurable host.
  const initializeViewer = () => {
    if (destroyed || lifecycle === "inactive" || pdfViewer || !loadedDocument) return
    eventBus = new EventBus()
    const viewerOptions = {
      abortSignal: abortController.signal,
      container,
      eventBus,
      removePageBorders: true,
      viewer,
    }
    pdfViewer = new PDFViewer(viewerOptions)
    renderingGate = installPDFRenderingGate(pdfViewer)

    eventBus.on("pagesinit", handlePagesInit)
    eventBus.on("pagesloaded", handlePagesLoaded)
    eventBus.on("updateviewarea", savePosition)
    eventBus.on("pagechanging", handlePageChange)
    eventBus.on("pagerendered", handlePageRendered)
    eventBus.on("textlayerrendered", handleTextRendered)
    eventBus.on("scalechanging", handleScaleChange)

    onPageCountChange(loadedDocument.numPages)
    pdfViewer.setDocument(loadedDocument)

    const pagesPromise: Promise<void> = pdfViewer.pagesPromise

    void pagesPromise.catch(reportFailure)
  }

  void loadingTask.promise
    .then((pdf) => {
      loadedDocument = pdf
      initializeViewer()
    })
    .catch(reportFailure)

  return {
    destroy: async () => {
      flushPosition()
      destroyed = true
      ready = false
      renderingGate?.setActive(false)
      cancelAnimationFrame(frame)
      clearTimeout(settledTimer)
      eventBus?.off("pagesinit", handlePagesInit)
      eventBus?.off("pagesloaded", handlePagesLoaded)
      eventBus?.off("updateviewarea", savePosition)
      eventBus?.off("pagechanging", handlePageChange)
      eventBus?.off("pagerendered", handlePageRendered)
      eventBus?.off("textlayerrendered", handleTextRendered)
      eventBus?.off("scalechanging", handleScaleChange)
      pdfViewer?.setDocument(null)
      abortController.abort()
      resizeObserver.disconnect()
      pdfViewer?.cleanup()
      renderingGate?.dispose()
      renderingGate = null
      await loadingTask.destroy().catch(() => undefined)
    },
    flushPosition,
    isReady: () => viewportReadiness(),
    reconcileLayout: () => {
      if (!ready) reconcileInitialPosition = true
      if (lifecycle !== "inactive" && pdfViewer?.pagesCount) {
        applyRequestedScale()
        pdfViewer.update()
      }
      scheduleReadiness()
    },
    setLifecycle: (next: typeof lifecycle) => {
      if (next === lifecycle) return
      if (lifecycle === "presented") {
        flushPosition()

        const current = window.getSelection()
        selection = null

        if (current?.rangeCount && container.contains(current.anchorNode)) {
          selection = current.getRangeAt(0).cloneRange()
          current.removeAllRanges()
        }
      }

      lifecycle = next
      renderingGate?.setActive(next !== "inactive")
      isCtrlKeyDown = false

      if (next === "inactive") {
        cancelAnimationFrame(frame)
        clearTimeout(settledTimer)

        for (let index = 0; index < (pdfViewer?.pagesCount ?? 0); index++) {
          const page: PDFPage = pdfViewer!.getPageView(index)

          if (page.renderingState !== RenderingStates.FINISHED) {
            page.reset()
          } else if (
            page.detailView &&
            page.detailView.renderingState !== RenderingStates.FINISHED
          ) {
            page.detailView.reset()
          }
        }
      } else {
        initializeViewer()
        if (pendingPagesInit) handlePagesInit()
        if (pendingPagesLoaded) handlePagesLoaded()
        pdfViewer?.update()

        if (next === "presented" && selection) {
          const current = window.getSelection()

          if (current && selection.startContainer.isConnected) {
            current.removeAllRanges()
            current.addRange(selection)
          }

          selection = null
        }

        scheduleReadiness()
      }
    },
    goToPage: (pageNumber: number) => {
      requestedPage = pageNumber
      if (
        lifecycle !== "inactive" &&
        pdfViewer?.pagesCount &&
        pdfViewer.currentPageNumber !== pageNumber
      ) {
        pdfViewer.currentPageNumber = pageNumber
      }

      scheduleReadiness()
    },
    setScale: (scale: PDFScale) => {
      if (requestedScale === scale) return

      const previousScale = pdfViewer?.currentScale
      requestedScale = scale

      if (lifecycle !== "inactive" && pdfViewer?.pagesCount) applyRequestedScale()
      if (pdfViewer?.currentScale === previousScale) flushPosition()

      scheduleReadiness()
    },
    setPageLayout: (pageLayout: PDFPageLayout) => {
      requestedPageLayout = pageLayout

      if (lifecycle !== "inactive" && pdfViewer?.pagesCount) applyRequestedLayout()

      scheduleReadiness()
    },
    setPageView: (pageView: PDFPageView) => {
      requestedPageView = pageView

      if (lifecycle !== "inactive" && pdfViewer?.pagesCount) applyRequestedLayout()

      scheduleReadiness()
    },
  }
}

export type PDFReaderRuntime = ReturnType<typeof createPDFReaderRuntime>
