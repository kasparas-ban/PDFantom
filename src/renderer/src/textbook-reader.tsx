import { useEffect, useState } from "react"
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist"
import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs?url"

import type { OpenedTextbook } from "../../shared/textbook-api"
import { useAppConfig } from "./store/app-config-provider"

GlobalWorkerOptions.workerSrc = workerSource

type TextbookReaderProps = {
  readonly textbook: OpenedTextbook
}

type PdfPageProps = {
  readonly document: PDFDocumentProxy
  readonly pageNumber: number
  readonly scale: number
}

function PdfPage({ document, pageNumber, scale }: PdfPageProps) {
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [textContainer, setTextContainer] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true
    void document.getPage(pageNumber).then((loadedPage) => {
      if (active) setPage(loadedPage)
    })

    return () => {
      active = false
    }
  }, [document, pageNumber])

  useEffect(() => {
    if (!page || !canvas || !textContainer) return

    const viewport = page.getViewport({ scale })
    const outputScale = window.devicePixelRatio || 1
    canvas.width = Math.floor(viewport.width * outputScale)
    canvas.height = Math.floor(viewport.height * outputScale)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`
    textContainer.replaceChildren()
    textContainer.style.setProperty("--scale-factor", `${viewport.scale}`)

    const renderTask = page.render({
      canvas,
      transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      viewport,
    })

    let textLayer: TextLayer | undefined
    let active = true

    void Promise.all([renderTask.promise, page.getTextContent()])
      .then(async ([, textContent]) => {
        if (!active) return

        textLayer = new TextLayer({
          container: textContainer,
          textContentSource: textContent,
          viewport,
        })
        await textLayer.render()
      })
      .catch(() => {})

    return () => {
      active = false
      renderTask.cancel()
      textLayer?.cancel()
    }
  }, [canvas, page, pageNumber, scale, textContainer])

  const viewport = page?.getViewport({ scale })

  return (
    <article
      aria-label={`Page ${pageNumber}`}
      className="page pdf-page relative mx-auto mb-7 overflow-hidden rounded-[3px] border-0 shadow-[0_2px_4px_rgba(24,24,23,0.08),0_12px_32px_rgba(24,24,23,0.13)]"
      style={viewport ? { height: viewport.height, width: viewport.width } : undefined}
    >
      <div className="canvasWrapper">
        <canvas ref={setCanvas} />
      </div>
      <div className="textLayer" ref={setTextContainer} />
      <span
        className="pointer-events-none absolute right-2.5 bottom-2.5 z-2 rounded-md bg-neutral-950/72 px-1.5 py-1 text-[0.65rem] leading-none text-white"
        aria-hidden="true"
      >
        {pageNumber}
      </span>
    </article>
  )
}

export function TextbookReader({ textbook }: TextbookReaderProps) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)

  const zoom = useAppConfig((state) => state.zoom)

  useEffect(() => {
    setDocument(null)
    setError(null)

    const loadingTask = getDocument({
      data: textbook.bytes.slice(0),
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
  }, [textbook])

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
        Opening {textbook.name}…
      </p>
    )
  }

  return (
    <section
      className="flex h-full w-full overflow-auto bg-[#e7e7e5] p-7 dark:bg-[#171716]"
      aria-label="PDF reader"
    >
      <div className="mb-3 text-center text-[0.7rem] text-muted-foreground">
        {document.numPages === 1 ? "1 page" : `${document.numPages} pages`}
      </div>
      <div className="pdfViewer mx-auto w-max">
        {Array.from({ length: document.numPages }, (_, index) => (
          <PdfPage document={document} key={index + 1} pageNumber={index + 1} scale={zoom} />
        ))}
      </div>
    </section>
  )
}
