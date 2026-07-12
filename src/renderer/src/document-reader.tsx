import { useEffect, useRef, useState } from "react"

import type { OpenedDocument } from "../../shared/document-api"
import {
  createPDFReaderRuntime,
  type PDFReaderRuntime,
  type PDFReaderStatus,
} from "./pdf-reader-runtime"
import { useReaderSession } from "./store/reader-session-provider"

type DocumentReaderProps = {
  readonly document: OpenedDocument
}

export function DocumentReader({ document }: DocumentReaderProps) {
  const zoom = useReaderSession((state) => state.zoom)
  const scalePreset = useReaderSession((state) => state.scalePreset)
  const currentPage = useReaderSession((state) => state.currentPage)
  const reportCurrentPage = useReaderSession((state) => state.reportCurrentPage)
  const reportPageCount = useReaderSession((state) => state.reportPageCount)
  const reportZoom = useReaderSession((state) => state.reportZoom)

  const [status, setStatus] = useState<PDFReaderStatus>({ state: "opening" })
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<PDFReaderRuntime>(null)
  const scaleRef = useRef(scalePreset ?? zoom)
  const currentPageRef = useRef(currentPage)

  const scale = scalePreset ?? zoom
  scaleRef.current = scale
  currentPageRef.current = currentPage

  useEffect(() => {
    if (!containerRef.current || !viewerRef.current) return

    const runtime = createPDFReaderRuntime({
      container: containerRef.current,
      document,
      onPageChange: reportCurrentPage,
      onPageCountChange: reportPageCount,
      onScaleChange: reportZoom,
      onStatusChange: setStatus,
      viewer: viewerRef.current,
    })
    runtimeRef.current = runtime
    runtime.setScale(scaleRef.current)
    runtime.goToPage(currentPageRef.current)

    return () => {
      runtime.destroy()
      runtimeRef.current = null
    }
  }, [document, reportCurrentPage, reportPageCount, reportZoom])

  useEffect(() => runtimeRef.current?.setScale(scale), [scale])
  useEffect(() => runtimeRef.current?.goToPage(currentPage), [currentPage])

  return (
    <section className="relative h-full w-full bg-[#e7e7e5] dark:bg-[#171716]">
      <div
        aria-label="PDF reader"
        className="absolute inset-0 overflow-auto outline-none"
        ref={containerRef}
      >
        <div className="pdfViewer pdf-reader-viewer pt-7" ref={viewerRef} />
      </div>

      {status.state !== "ready" && (
        <div className="absolute inset-0 z-10 flex items-start justify-center bg-background">
          {status.state === "failed" ? (
            <p className="mx-auto my-8 max-w-152 text-center text-destructive" role="alert">
              {status.message}
            </p>
          ) : (
            <p className="mx-auto my-8 max-w-152 text-center text-muted-foreground">
              Opening {document.name}…
            </p>
          )}
        </div>
      )}
    </section>
  )
}
