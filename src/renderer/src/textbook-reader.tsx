import { useCallback, useEffect, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist";
import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { OpenedTextbook } from "../../shared/textbook-api";

GlobalWorkerOptions.workerSrc = workerSource;

interface TextbookReaderProps {
  readonly textbook: OpenedTextbook;
}

interface PdfPageProps {
  readonly document: PDFDocumentProxy;
  readonly onTextAnalyzed: (pageNumber: number, hasText: boolean) => void;
  readonly pageNumber: number;
  readonly scale: number;
}

function PdfPage({ document, onTextAnalyzed, pageNumber, scale }: PdfPageProps) {
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [textContainer, setTextContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    void document.getPage(pageNumber).then((loadedPage) => {
      if (active) setPage(loadedPage);
    });

    return () => {
      active = false;
    };
  }, [document, pageNumber]);

  useEffect(() => {
    if (!page || !canvas || !textContainer) return;

    const viewport = page.getViewport({ scale });
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    textContainer.replaceChildren();
    textContainer.style.setProperty("--scale-factor", `${viewport.scale}`);

    const renderTask = page.render({
      canvas,
      transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      viewport,
    });
    let textLayer: TextLayer | undefined;
    let active = true;

    void Promise.all([renderTask.promise, page.getTextContent()])
      .then(async ([, textContent]) => {
        if (!active) return;

        const hasText = textContent.items.some(
          (item) => "str" in item && item.str.trim().length > 0,
        );
        textLayer = new TextLayer({
          container: textContainer,
          textContentSource: textContent,
          viewport,
        });
        await textLayer.render();
        if (active) onTextAnalyzed(pageNumber, hasText);
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          onTextAnalyzed(pageNumber, false);
        }
      });

    return () => {
      active = false;
      renderTask.cancel();
      textLayer?.cancel();
    };
  }, [canvas, onTextAnalyzed, page, pageNumber, scale, textContainer]);

  const viewport = page?.getViewport({ scale });

  return (
    <article
      aria-label={`Page ${pageNumber}`}
      className="page pdf-page"
      style={viewport ? { height: viewport.height, width: viewport.width } : undefined}
    >
      <div className="canvasWrapper">
        <canvas ref={setCanvas} />
      </div>
      <div className="textLayer" ref={setTextContainer} />
      <span className="page-number" aria-hidden="true">
        {pageNumber}
      </span>
    </article>
  );
}

export function TextbookReader({ textbook }: TextbookReaderProps) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.15);
  const [textByPage, setTextByPage] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setDocument(null);
    setError(null);
    setTextByPage({});

    const loadingTask = getDocument({
      data: textbook.bytes.slice(0),
      useWorkerFetch: false,
    });
    let active = true;

    void loadingTask.promise
      .then((loadedDocument) => {
        if (active) setDocument(loadedDocument);
      })
      .catch(() => {
        if (active) setError("This PDF could not be opened.");
      });

    return () => {
      active = false;
      void loadingTask.destroy();
    };
  }, [textbook]);

  const handleTextAnalyzed = useCallback((pageNumber: number, hasText: boolean) => {
    setTextByPage((current) =>
      current[pageNumber] === hasText ? current : { ...current, [pageNumber]: hasText },
    );
  }, []);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!document) {
    return <p className="loading-status">Opening {textbook.name}…</p>;
  }

  const analyzedAllPages = Object.keys(textByPage).length === document.numPages;
  const hasSelectableText = Object.values(textByPage).some(Boolean);

  return (
    <section className="reader" aria-label="Textbook reader">
      <div className="reader-toolbar">
        <div className="document-details">
          <h2>{textbook.name}</h2>
          <p>{document.numPages === 1 ? "1 page" : `${document.numPages} pages`}</p>
        </div>
        <p className="text-status" aria-live="polite">
          {!analyzedAllPages
            ? "Checking for selectable text…"
            : hasSelectableText
              ? "Selectable text available"
              : "No selectable text — scanned pages remain viewable"}
        </p>
        <div className="zoom-controls" aria-label="Zoom controls">
          <button
            aria-label="Zoom out"
            className="secondary-button"
            disabled={scale <= 0.7}
            onClick={() => setScale((current) => Math.max(0.7, current - 0.15))}
            type="button"
          >
            −
          </button>
          <output aria-label="Zoom level">{Math.round(scale * 100)}%</output>
          <button
            aria-label="Zoom in"
            className="secondary-button"
            disabled={scale >= 1.9}
            onClick={() => setScale((current) => Math.min(1.9, current + 0.15))}
            type="button"
          >
            +
          </button>
        </div>
      </div>
      <div className="document-viewport">
        <div className="pdfViewer">
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
  );
}
