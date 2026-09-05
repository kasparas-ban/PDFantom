// Test composition root, bundled separately and never included in the application.
export {
  ReaderPreviewCache,
  capturePreview,
  compatiblePreview,
  decodePreview,
  safeViewport,
} from "../../src/renderer/src/reader/reader-preview"
export {
  createPDFReaderRuntime,
  createReaderWorker,
} from "../../src/renderer/src/reader/pdf-reader-runtime"
export { ReaderWorkspace } from "../../src/renderer/src/reader/reader-workspace"
export { createReaderSurfaces } from "../../src/renderer/src/reader/document-reader"
export { createReaderSessionStore } from "../../src/renderer/src/store/reader-session-store"
export { getDocument, PDFWorker } from "pdfjs-dist"
export { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs"
