import { useEffect, useRef, useState } from "react"
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist"
import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { EventBus, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs"

import type { OpenedDocument } from "../../shared/document-api"
import { useAppConfig } from "./store/app-config-provider"

declare module "pdfjs-dist/web/pdf_viewer.mjs" {
  // eslint-disable-next-line typescript/consistent-type-definitions -- Declaration merging requires an interface.
  interface PDFViewer {
    setDocument(pdfDocument: PDFDocumentProxy | null): void
  }
}

GlobalWorkerOptions.workerSrc = workerSource

type DocumentReaderProps = {
  readonly document: OpenedDocument
}

export function DocumentReader({ document: openedDocument }: DocumentReaderProps) {
  const zoom = useAppConfig((state) => state.zoom)

  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const pdfViewerRef = useRef<PDFViewer>(null)
  const zoomRef = useRef(zoom)

  zoomRef.current = zoom

  useEffect(() => {
    setDocument(null)
    setError(null)

    const loadingTask = getDocument({
      data: openedDocument.bytes.slice(0),
      useWorkerFetch: false,
    })
    let active = true

    void loadingTask.promise
      .then((loadedDocument) => {
        if (active) setDocument(loadedDocument)
      })
      .catch(() => {
        if (active) setError("This PDF could not be opened.")
      })

    return () => {
      active = false
      void loadingTask.destroy()
    }
  }, [openedDocument])

  useEffect(() => {
    if (!document || !containerRef.current || !viewerRef.current) return

    const abortController = new AbortController()
    const eventBus = new EventBus()
    const viewerOptions = {
      abortSignal: abortController.signal,
      container: containerRef.current,
      eventBus,
      viewer: viewerRef.current,
    }
    const pdfViewer = new PDFViewer(viewerOptions)
    const setInitialScale = () => {
      pdfViewer.currentScale = zoomRef.current
    }

    pdfViewerRef.current = pdfViewer
    eventBus.on("pagesinit", setInitialScale)
    pdfViewer.setDocument(document)

    return () => {
      eventBus.off("pagesinit", setInitialScale)
      pdfViewer.setDocument(null)
      abortController.abort()
      pdfViewer.cleanup()
      pdfViewerRef.current = null
    }
  }, [document])

  useEffect(() => {
    const pdfViewer = pdfViewerRef.current
    if (pdfViewer?.pagesCount) pdfViewer.currentScale = zoom
  }, [zoom])

  if (error) {
    return (
      <p className="mx-auto my-8 max-w-152 text-center text-destructive" role="alert">
        {error}
      </p>
    )
  }

  if (!document) {
    return (
      <p className="mx-auto my-8 max-w-152 text-center text-muted-foreground">
        Opening {openedDocument.name}…
      </p>
    )
  }

  return (
    <section className="relative h-full w-full bg-[#e7e7e5] dark:bg-[#171716]">
      <div
        aria-label="PDF reader"
        className="absolute inset-0 overflow-auto outline-none"
        ref={containerRef}
      >
        <div className="pdfViewer pdf-reader-viewer pt-7" ref={viewerRef} />
      </div>
    </section>
  )
}
