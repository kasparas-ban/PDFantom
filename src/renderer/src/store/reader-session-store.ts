import { createStore } from "zustand/vanilla"

import {
  documentVersionKey,
  type ActiveDocumentState,
  type DocumentLibrarySnapshot,
  type DocumentSummary,
} from "../../../shared/document-api"
import { DEFAULT_READER_VIEW, type PDFScalePreset, type ReadingPosition } from "../reader-model"
import {
  loadReadingPosition,
  saveReadingPosition,
  type ReadingPositionStorage,
} from "./reader-position-storage"

export type ReaderView = Omit<ReadingPosition, "pageNumber" | "offsetX" | "offsetY"> & {
  currentPage: number
  pageCount: number
  initialReadingPosition: ReadingPosition | null
  position: ReadingPosition | null
  interactive: boolean
}

const defaultView = (): ReaderView => ({
  ...DEFAULT_READER_VIEW,
  currentPage: 1,
  pageCount: 0,
  initialReadingPosition: null,
  position: null,
  interactive: false,
})

export type ReaderSessionState = ReaderView & {
  activeDocument: ActiveDocumentState
  selectedDocument: DocumentSummary | null
  documents: readonly DocumentSummary[]
  views: Record<string, ReaderView>
  isDocumentLibraryHydrated: boolean
  sourceStatus: "checking" | "preparing" | null
  error: string | null
  readingPositionError: string | null
  loadDocumentLibrary: (snapshot: DocumentLibrarySnapshot) => void
  initializeDocument: (document: DocumentSummary, allowLegacy: boolean) => ReaderView
  replaceVersion: (document: DocumentSummary) => void
  discardView: (document: DocumentSummary) => void
  present: (document: ActiveDocumentState) => void
  reportView: (document: DocumentSummary, patch: Partial<ReaderView>) => void
  reportReadingPosition: (document: DocumentSummary, position: ReadingPosition) => void
  requestPage: (pageNumber: number) => number
  setZoom: (zoom: number) => void
  setScalePreset: (preset: PDFScalePreset) => void
  togglePageView: () => void
  togglePageLayout: () => void
}

export function createReaderSessionStore(positionStorage: ReadingPositionStorage) {
  return createStore<ReaderSessionState>()((set, get) => {
    const save = (document: DocumentSummary, position: ReadingPosition | null) => {
      try {
        saveReadingPosition(positionStorage, document, position)
        set({ readingPositionError: null })
      } catch {
        set({ readingPositionError: "Your reading position could not be saved on this Mac." })
      }
    }

    const command = (patch: Partial<ReaderView>) => {
      const { activeDocument, interactive } = get()

      if (activeDocument.status === "loaded" && interactive) {
        get().reportView(activeDocument.document, patch)
      }
    }

    return {
      ...defaultView(),
      activeDocument: { status: "none" },
      selectedDocument: null,
      documents: [],
      views: {},
      isDocumentLibraryHydrated: false,
      sourceStatus: null,
      error: null,
      readingPositionError: null,
      // Metadata never resets a view or replaces a runtime.
      loadDocumentLibrary: ({ selectedDocument, documents }) =>
        set({ selectedDocument, documents, isDocumentLibraryHydrated: true }),
      initializeDocument: (document, allowLegacy) => {
        const key = documentVersionKey(document)
        const existing = get().views[key]
        if (existing && (!allowLegacy || existing.position)) return existing

        const position = loadReadingPosition(positionStorage, document, allowLegacy)
        if (position && allowLegacy) save(document, position)

        const view: ReaderView = {
          ...defaultView(),
          ...position,
          currentPage: position?.pageNumber ?? 1,
          initialReadingPosition: position,
          position,
        }

        set((state) => ({ views: { ...state.views, [key]: view } }))

        return view
      },
      replaceVersion: (document) => {
        // A fingerprint tombstone prevents a legacy record from being adopted on restart.
        save(document, null)
        set((state) => ({
          views: Object.fromEntries(
            Object.entries(state.views).filter(([key]) => !key.startsWith(`${document.id}:`)),
          ),
        }))
      },
      discardView: (document) =>
        set((state) => ({
          views: Object.fromEntries(
            Object.entries(state.views).filter(([key]) => key !== documentVersionKey(document)),
          ),
        })),
      present: (activeDocument) => {
        const view =
          activeDocument.status === "loaded" || activeDocument.status === "preview"
            ? (get().views[documentVersionKey(activeDocument.document)] ?? defaultView())
            : defaultView()

        set({
          ...view,
          activeDocument,
          interactive: activeDocument.status === "loaded" && view.interactive,
        })
      },
      reportView: (document, patch) => {
        const key = documentVersionKey(document)
        const state = get()
        if (!state.views[key]) return

        const view = { ...state.views[key], ...patch }
        const isPresented =
          state.activeDocument.status === "loaded" &&
          documentVersionKey(state.activeDocument.document) === key

        set({ views: { ...state.views, [key]: view }, ...(isPresented ? view : {}) })
      },
      reportReadingPosition: (document, position) => {
        if (!get().views[documentVersionKey(document)]) return

        get().reportView(document, { position })
        save(document, position)
      },
      requestPage: (page) => {
        const { currentPage, pageCount } = get()
        if (!Number.isInteger(page) || page < 1 || page > pageCount) return currentPage

        command({ currentPage: page })

        return get().currentPage
      },
      setZoom: (zoom) => command({ zoom, scalePreset: null }),
      setScalePreset: (scalePreset) => command({ scalePreset }),
      togglePageView: () =>
        command(
          get().pageView === "single"
            ? { pageView: "double", scalePreset: "page-fit" }
            : { pageView: "single" },
        ),
      togglePageLayout: () =>
        command({ pageLayout: get().pageLayout === "vertical" ? "horizontal" : "vertical" }),
    }
  })
}

export type ReaderSessionStore = ReturnType<typeof createReaderSessionStore>
