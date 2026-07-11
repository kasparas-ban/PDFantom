import { useCallback, useEffect, useState } from "react"
import { Minus, PanelLeftClose, Plus } from "lucide-react"
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist"
import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs?url"

import { Button } from "@/components/ui/button"
import type { OpenedTextbook } from "../../shared/textbook-api"

GlobalWorkerOptions.workerSrc = workerSource

type TextbookReaderProps = {
  readonly onShowSidebar: () => void
  readonly sidebarOpen: boolean
  readonly textbook: OpenedTextbook
}

type PdfPageProps = {
  readonly document: PDFDocumentProxy
  readonly onTextAnalyzed: (pageNumber: number, hasText: boolean) => void
  readonly pageNumber: number
  readonly scale: number
}

function PdfPage({ document, onTextAnalyzed, pageNumber, scale }: PdfPageProps) {
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

        const hasText = textContent.items.some(
          (item) => "str" in item && item.str.trim().length > 0,
        )
        textLayer = new TextLayer({
          container: textContainer,
          textContentSource: textContent,
          viewport,
        })
        await textLayer.render()
        if (active) onTextAnalyzed(pageNumber, hasText)
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          onTextAnalyzed(pageNumber, false)
        }
      })

    return () => {
      active = false
      renderTask.cancel()
      textLayer?.cancel()
    }
  }, [canvas, onTextAnalyzed, page, pageNumber, scale, textContainer])

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

export function TextbookReader({ onShowSidebar, sidebarOpen, textbook }: TextbookReaderProps) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1.15)
  const [textByPage, setTextByPage] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setDocument(null)
    setError(null)
    setTextByPage({})

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

  const handleTextAnalyzed = useCallback((pageNumber: number, hasText: boolean) => {
    setTextByPage((current) =>
      current[pageNumber] === hasText ? current : { ...current, [pageNumber]: hasText },
    )
  }, [])

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

  const analyzedAllPages = Object.keys(textByPage).length === document.numPages
  const hasSelectableText = Object.values(textByPage).some(Boolean)

  return (
    <section
      className="grid h-full grid-rows-[3rem_minmax(0,1fr)]"
      aria-label="Textbook reader"
    >
      <header className="window-drag-region grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-border/70 bg-background px-3">
        <div className="window-no-drag flex min-w-0 items-center gap-2 pl-1">
          {!sidebarOpen && (
            <Button
              aria-label="Show sidebar"
              className="text-muted-foreground"
              onClick={onShowSidebar}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <PanelLeftClose className="rotate-180" />
            </Button>
          )}
          <h2 className="truncate text-[0.82rem] font-medium">{textbook.name}</h2>
        </div>
        <div
          className="window-no-drag flex items-center rounded-lg border border-border/80 bg-muted/50 p-0.5 shadow-xs"
          aria-label="Zoom controls"
        >
          <Button
            aria-label="Zoom out"
            className="size-6 rounded-md"
            disabled={scale <= 0.7}
            onClick={() => setScale((current) => Math.max(0.7, current - 0.15))}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Minus />
          </Button>
          <output className="min-w-11 text-center text-[0.72rem] tabular-nums" aria-label="Zoom level">
            {Math.round(scale * 100)}%
          </output>
          <Button
            aria-label="Zoom in"
            className="size-6 rounded-md"
            disabled={scale >= 1.9}
            onClick={() => setScale((current) => Math.min(1.9, current + 0.15))}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Plus />
          </Button>
        </div>
        <div className="window-no-drag flex items-center justify-self-end">
          <p className="hidden text-[0.72rem] text-muted-foreground min-[980px]:block" aria-live="polite">
            {!analyzedAllPages
              ? "Checking text…"
              : hasSelectableText
                ? "Selectable text available"
                : "Scanned document"}
          </p>
        </div>
      </header>
      <div className="overflow-auto bg-[#e7e7e5] p-7 dark:bg-[#171716]">
        <div className="mb-3 text-center text-[0.7rem] text-muted-foreground">
          {document.numPages === 1 ? "1 page" : `${document.numPages} pages`}
        </div>
        <div className="pdfViewer mx-auto w-max">
          {Array.from({ length: document.numPages }, (_, index) => (
            <PdfPage
              document={document}
              key={index + 1}
              onTextAnalyzed={handleTextAnalyzed}
              pageNumber={index + 1}
              scale={scale}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
