import { createStore } from "zustand/vanilla"

import type {
  ActiveDocumentState,
  DocumentLibrarySnapshot,
  DocumentSummary,
} from "../../../shared/document-api"
import {
  DEFAULT_READER_VIEW,
  type PDFPageLayout,
  type PDFPageView,
  type PDFScalePreset,
  type ReadingPosition,
} from "../reader-model"
import {
  loadReadingPosition,
  saveReadingPosition,
  type ReadingPositionStorage,
} from "./reader-position-storage"

export type ReaderSessionState = {
  activeDocument: ActiveDocumentState
  documents: readonly DocumentSummary[]
  isDocumentLibraryHydrated: boolean
  loadDocumentLibrary: (snapshot: DocumentLibrarySnapshot) => void
  initialReadingPosition: ReadingPosition | null
  reportReadingPosition: (documentId: string, position: ReadingPosition) => void
  readingPositionError: string | null

  currentPage: number
  pageCount: number
  requestPage: (pageNumber: number) => number
  reportCurrentPage: (pageNumber: number) => void
  reportPageCount: (pageCount: number) => void

  zoom: number
  setZoom: (zoom: number) => void
  reportZoom: (zoom: number) => void
  scalePreset: PDFScalePreset | null
  setScalePreset: (scalePreset: PDFScalePreset) => void

  pageView: PDFPageView
  togglePageView: () => void

  pageLayout: PDFPageLayout
  togglePageLayout: () => void
}

export const createReaderSessionStore = (positionStorage: ReadingPositionStorage) =>
  createStore<ReaderSessionState>()((set, get) => ({
    activeDocument: { status: "none" },
    documents: [],
    isDocumentLibraryHydrated: false,
    loadDocumentLibrary: ({ activeDocument, documents }) => {
      const position =
        activeDocument.status === "loaded"
          ? loadReadingPosition(positionStorage, activeDocument.document.id)
          : null
      set({
        activeDocument,
        currentPage: position?.pageNumber ?? 1,
        documents,
        initialReadingPosition: position,
        isDocumentLibraryHydrated: true,
        pageCount: 0,
        pageLayout: position?.pageLayout ?? DEFAULT_READER_VIEW.pageLayout,
        pageView: position?.pageView ?? DEFAULT_READER_VIEW.pageView,
        scalePreset: position ? position.scalePreset : DEFAULT_READER_VIEW.scalePreset,
        zoom: position?.zoom ?? DEFAULT_READER_VIEW.zoom,
      })
    },
    initialReadingPosition: null,
    readingPositionError: null,
    reportReadingPosition: (documentId, position) => {
      try {
        saveReadingPosition(positionStorage, documentId, position)
        if (get().readingPositionError) set({ readingPositionError: null })
      } catch {
        if (!get().readingPositionError) {
          set({ readingPositionError: "Your reading position could not be saved on this Mac." })
        }
      }
    },

    currentPage: 1,
    pageCount: 0,
    requestPage: (requestedPage) => {
      const { currentPage, pageCount } = get()
      if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > pageCount) {
        return currentPage
      }

      set({ currentPage: requestedPage })
      return requestedPage
    },
    reportCurrentPage: (reportedPage) =>
      set((state) => {
        if (!Number.isInteger(reportedPage)) return state

        return {
          currentPage: Math.min(Math.max(1, reportedPage), Math.max(1, state.pageCount)),
        }
      }),
    reportPageCount: (reportedPageCount) =>
      set((state) => {
        const pageCount = Number.isFinite(reportedPageCount)
          ? Math.max(0, Math.floor(reportedPageCount))
          : 0
        return {
          pageCount,
          currentPage: Math.min(state.currentPage, Math.max(1, pageCount)),
        }
      }),

    zoom: DEFAULT_READER_VIEW.zoom,
    setZoom: (zoom) => set({ scalePreset: null, zoom }),
    reportZoom: (zoom) => set({ zoom }),
    scalePreset: DEFAULT_READER_VIEW.scalePreset,
    setScalePreset: (scalePreset) => set({ scalePreset }),

    pageView: DEFAULT_READER_VIEW.pageView,
    togglePageView: () =>
      set((state) =>
        state.pageView === "single"
          ? { pageView: "double", scalePreset: "page-fit" }
          : { pageView: "single" },
      ),

    pageLayout: DEFAULT_READER_VIEW.pageLayout,
    togglePageLayout: () =>
      set((state) => ({
        pageLayout: state.pageLayout === "vertical" ? "horizontal" : "vertical",
      })),
  }))

export type ReaderSessionStore = ReturnType<typeof createReaderSessionStore>
