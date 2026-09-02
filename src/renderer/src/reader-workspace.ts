import type { PDFWorker } from "pdfjs-dist"

import {
  documentVersionKey,
  type DocumentApi,
  type DocumentSummary,
  type OpenedDocument,
} from "../../shared/document-api"
import type { PDFReaderRuntime, PDFReaderStatus } from "./pdf-reader-runtime"
import {
  sameAppearance,
  type ReaderPreview,
  type ReaderPreviewCache,
  type ViewportAppearance,
} from "./reader-preview"
import type { ReaderSessionStore } from "./store/reader-session-store"

export type ReaderSurface = {
  runtime: PDFReaderRuntime
  show: () => void
  prepare: () => void
  hide: () => void
  compatible: () => boolean
  capture: () => Promise<Blob | null>
  dispose: () => Promise<void>
}

export type PreviewSurface = { show: () => void; dispose: () => void }

export type ReaderSurfaces = {
  appearance: () => ViewportAppearance
  create: (
    document: OpenedDocument,
    worker: PDFWorker,
    onStatus: (status: PDFReaderStatus) => void,
    onSettled: () => void,
  ) => ReaderSurface
  preview: (record: ReaderPreview) => Promise<PreviewSurface | null>
}

type Entry = {
  document: DocumentSummary
  surface: ReaderSurface
  used: number
  verified: boolean
  captureRevision: number
}

// One concrete owner for intent, resource lifetime and atomic presentation.
// PDF.js objects and DOM stay here, never in the application store.
export class ReaderWorkspace {
  private readonly entries = new Map<string, Entry>()
  private readonly checks = new Map<string, number>()
  private readonly teardown = new Set<Promise<void>>()
  private worker: PDFWorker | null = null
  private preview: PreviewSurface | null = null
  private previewAppearance: ViewportAppearance | null = null
  private intent = 0
  private clock = 0
  private presented: string | null = null
  private target: string | null = null
  private disposed = false
  private suspended = false

  constructor(
    private readonly api: DocumentApi,
    private readonly store: ReaderSessionStore,
    private readonly surfaces: ReaderSurfaces,
    private readonly previews: Pick<
      ReaderPreviewCache,
      "read" | "write" | "invalidate" | "ticket" | "dispose"
    >,
    private readonly createWorker: () => PDFWorker,
  ) {}

  warm() {
    if (this.disposed || this.worker) return
    try {
      this.worker = this.createWorker()

      void this.worker.promise.catch(() => {
        if (this.disposed) return

        for (const entry of this.entries.values()) this.invalidate(entry.document)

        this.store.setState({
          error: "The PDF reader could not start. Reopen the document to try again.",
        })
        this.worker?.destroy()
        this.worker = null
      })
    } catch {
      this.store.setState({ error: "The PDF reader could not start." })
    }
  }

  async restore() {
    const generation = ++this.intent
    try {
      const library = await this.api.getDocumentLibrary()
      if (!this.current(generation)) return

      performance.clearMarks("reader-metadata-ready")
      performance.mark("reader-metadata-ready")
      this.store.getState().loadDocumentLibrary(library)

      if (library.selectedDocument) await this.prepare(library.selectedDocument, generation)
    } catch {
      if (this.current(generation)) {
        this.store.setState({
          isDocumentLibraryHydrated: true,
          error: "The document library could not be loaded.",
        })
      }
    }
  }

  async open() {
    const generation = ++this.intent
    this.store.setState({ error: null })

    try {
      const result = await this.api.openDocument()
      if (this.disposed) return

      if (result && result.previousFingerprint !== result.document.fingerprint) {
        if (result.previousFingerprint) {
          this.invalidate({ ...result.document, fingerprint: result.previousFingerprint })
        }
        this.store.getState().replaceVersion(result.document)
      }

      if (!this.current(generation)) return

      if (!result) {
        const selected = this.store.getState().selectedDocument

        if (selected && this.target !== this.presented) await this.prepare(selected, generation)

        return
      }

      await this.select(
        result.document,
        generation,
        result.document,
      )
    } catch {
      if (this.current(generation)) {
        this.store.setState({ error: "The document could not be opened.", sourceStatus: null })
      }
    }
  }

  async activate(id: string) {
    const document = this.store.getState().documents.find((item) => item.id === id)
    if (!document) return

    if (this.target === documentVersionKey(document) && this.presented === this.target) return

    await this.select(document, ++this.intent)
  }

  private async select(
    summary: DocumentSummary,
    generation: number,
    opened?: OpenedDocument,
  ) {
    const document = { id: summary.id, name: summary.name, fingerprint: summary.fingerprint }
    this.store.setState({ error: null })

    // Presentation need not wait even for the short selection IPC.
    const preparation = this.prepare(document, generation, opened)

    try {
      const library = await this.api.activateDocument(document.id, document.fingerprint)
      if (this.current(generation)) this.store.getState().loadDocumentLibrary(library)
    } catch {
      if (this.current(generation)) {
        ++this.intent
        this.store.setState({
          error: "The selection could not be saved. Restoring the last confirmed selection.",
          sourceStatus: null,
        })
        await this.restore()
      }
    }

    await preparation
  }

  private async prepare(
    document: DocumentSummary,
    generation: number,
    opened?: OpenedDocument,
  ) {
    const key = documentVersionKey(document)
    this.target = key
    this.store.setState({
      selectedDocument: document,
      sourceStatus: opened ? "preparing" : "checking",
    })

    const retained = this.entries.get(key)

    for (const [otherKey, entry] of this.entries) {
      if (otherKey !== key && otherKey !== this.presented) entry.surface.hide()
    }

    if (retained) {
      retained.verified = Boolean(opened)
      retained.used = ++this.clock
      const compatible = retained.surface.compatible()
      if (this.presented !== key || this.preview) retained.surface.prepare()
      if (compatible && retained.surface.runtime.isReady()) this.reveal(retained)
    }

    const check = (this.checks.get(key) ?? 0) + 1
    this.checks.set(key, check)

    if (!retained) void this.tryPreview(document, generation, check)

    try {
      const result = opened
        ? { status: "verified" as const, document, bytes: opened.bytes }
        : await this.api.loadDocument(document.id, document.fingerprint, !retained)

      if (this.disposed || this.checks.get(key) !== check) return

      if (result.status === "unavailable") {
        this.invalidate(document)
        if (this.current(generation)) {
          this.clearPresentation()
          this.store.getState().present(result)
          this.store.setState({ sourceStatus: null })
        }

        return
      }

      if (retained && this.entries.get(key) === retained) retained.verified = true
      if (!this.current(generation)) return

      this.store.setState({ sourceStatus: retained && this.presented === key ? null : "preparing" })

      if (retained) return
      if (!result.bytes) throw new Error("The PDF bytes are unavailable.")

      this.store.getState().initializeDocument(document)
      this.warm()

      if (!this.worker) throw new Error("The PDF worker is unavailable.")

      this.evict(key)

      const surface = this.surfaces.create(
        { ...document, bytes: result.bytes },
        this.worker,
        (status) => {
          if (status.state !== "opening" && this.entries.get(key)?.surface === surface) {
            this.status(document, status)
          }
        },
        () => {
          if (this.entries.get(key)?.surface === surface) void this.capture(document)
        },
      )

      const entry: Entry = {
        document,
        surface,
        used: ++this.clock,
        verified: true,
        captureRevision: 0,
      }

      this.entries.set(key, entry)
      surface.prepare()
    } catch {
      if (this.disposed || this.checks.get(key) !== check) return

      this.invalidate(document)

      if (this.current(generation)) {
        this.clearPresentation()
        this.store.getState().present({ status: "unavailable", document, reason: "unreadable" })
        this.store.setState({ error: "This PDF could not be opened.", sourceStatus: null })
      }
    }
  }

  private async tryPreview(document: DocumentSummary, generation: number, check: number) {
    const key = documentVersionKey(document)
    const view = this.store.getState().initializeDocument(document)
    const appearance = this.surfaces.appearance()
    const record = await this.previews.read(document, view.position, appearance)

    if (
      !record ||
      !this.current(generation) ||
      this.checks.get(key) !== check ||
      (this.presented === key && this.store.getState().activeDocument.status === "loaded")
    ) {
      return
    }

    const preview = await this.surfaces.preview(record)
    if (!preview) return

    if (
      !this.current(generation) ||
      this.checks.get(key) !== check ||
      this.target !== key ||
      (this.presented === key && this.store.getState().activeDocument.status === "loaded") ||
      !sameAppearance(appearance, this.surfaces.appearance())
    ) {
      preview.dispose()
      return
    }

    this.clearPresentation()
    this.preview = preview
    this.previewAppearance = appearance
    this.presented = key
    this.store.getState().reportView(document, {
      ...record.position,
      currentPage: record.position.pageNumber,
      pageCount: record.pageCount,
    })

    preview.show()
    this.store.getState().present({ status: "preview", document })

    performance.clearMarks("reader-preview-presented")
    performance.mark("reader-preview-presented")
  }

  private status(document: DocumentSummary, status: PDFReaderStatus) {
    const key = documentVersionKey(document)
    const entry = this.entries.get(key)
    if (!entry || this.disposed) return

    if (status.state === "failed") {
      this.invalidate(document)

      if (this.target === key) {
        this.clearPresentation()
        this.store.getState().present({ status: "unavailable", document, reason: "invalid" })
        this.store.setState({ error: status.message, sourceStatus: null })
      }

      return
    }

    if (status.state !== "ready") return

    // Once live, navigation remains available while a newly requested page
    // draws its text layer. Initial preview hydration still waits for it.
    const interactive = status.interactive || this.store.getState().views[key].interactive

    this.store.getState().reportView(document, { interactive })

    if (this.target === key && !this.suspended) this.reveal(entry)
  }

  private reveal(entry: Entry) {
    const key = documentVersionKey(entry.document)
    if (this.presented === key && !this.preview) return

    this.clearPresentation()
    this.presented = key
    entry.surface.show()
    this.store.getState().present({ status: "loaded", document: entry.document })
    this.store.setState({ sourceStatus: entry.verified ? null : "checking" })

    performance.clearMarks("reader-live-presented")
    performance.mark("reader-live-presented")
  }

  private clearPresentation() {
    if (this.presented) this.entries.get(this.presented)?.surface.hide()

    this.preview?.dispose()
    this.preview = null
    this.previewAppearance = null
    this.presented = null
  }

  private evict(incoming: string) {
    while (this.entries.size >= 3) {
      const victim = [...this.entries.entries()]
        .filter(([key]) => key !== this.presented && key !== incoming)
        .toSorted(([, a], [, b]) => a.used - b.used)[0]
      if (!victim) break

      this.remove(victim[1])
    }
  }

  private remove(entry: Entry) {
    this.entries.delete(documentVersionKey(entry.document))

    const teardown = entry.surface.dispose()

    this.teardown.add(teardown)
    void teardown.finally(() => this.teardown.delete(teardown))

    this.store.getState().discardView(entry.document)
  }

  private invalidate(document: DocumentSummary) {
    const key = documentVersionKey(document)
    this.checks.set(key, (this.checks.get(key) ?? 0) + 1)
    void this.previews.invalidate(document)

    if (this.presented === key) {
      this.clearPresentation()
      this.store.getState().present({ status: "none" })
    }

    const entry = this.entries.get(key)

    if (entry) {
      this.remove(entry)
    } else {
      this.store.getState().discardView(document)
    }
  }

  private async capture(document: DocumentSummary) {
    const key = documentVersionKey(document)
    const entry = this.entries.get(key)
    const position = this.store.getState().views[key]?.position
    if (
      !entry ||
      !entry.verified ||
      !position ||
      this.presented !== key ||
      this.preview ||
      this.suspended ||
      this.store.getState().readingPositionError
    ) {
      return
    }

    const appearance = this.surfaces.appearance()
    const ticket = this.previews.ticket(document)
    const revision = ++entry.captureRevision
    const eligible = () =>
      ticket.valid() &&
      this.entries.get(key) === entry &&
      entry.captureRevision === revision &&
      this.presented === key &&
      !this.suspended &&
      this.store.getState().views[key]?.position === position

    try {
      const blob = await entry.surface.capture()
      if (!blob || !eligible()) return

      await this.previews.write(
        {
          ...appearance,
          generation: ticket.generation,
          revision: ticket.revision,
          key,
          documentId: document.id,
          fingerprint: document.fingerprint,
          blob,
          bytes: blob.size,
          position,
          pageCount: this.store.getState().views[key].pageCount,
          lastUsed: Date.now(),
        },
        eligible,
      )
    } catch {
      /* A preview is never required to read or save a position. */
    }
  }

  suspend(suspended: boolean) {
    this.suspended = suspended

    for (const [key, entry] of this.entries) {
      if (suspended) {
        entry.surface.hide()
      } else if (key === this.presented && !this.preview) {
        const compatible = entry.surface.compatible()

        entry.surface.prepare()

        if (compatible && entry.surface.runtime.isReady()) {
          entry.surface.show()
        } else {
          this.presented = null
          this.store.getState().present({ status: "none" })
        }
      } else if (key === this.target) entry.surface.prepare()
    }
  }

  layoutChanged() {
    if (
      !this.preview ||
      sameAppearance(this.previewAppearance, this.surfaces.appearance())
    ) {
      return
    }

    this.clearPresentation()
    this.store.getState().present({ status: "none" })

    // Do not stretch an incompatible image. The measurable incoming reader
    // continues preparing while the normal welcome surface is exposed.
  }

  private current(generation: number) {
    return !this.disposed && generation === this.intent
  }

  async dispose() {
    this.disposed = true
    this.clearPresentation()

    for (const entry of this.entries.values()) this.remove(entry)

    this.previews.dispose()
    await Promise.allSettled(this.teardown)

    this.worker?.destroy()
    this.worker = null
  }
}
