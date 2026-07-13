import { createStore } from "zustand/vanilla"

import type {
  ActiveDocumentState,
  DocumentLibrarySnapshot,
  DocumentSummary,
} from "../../../shared/document-api"
import type { PDFPageLayout, PDFPageView, PDFScalePreset } from "../pdf-reader-runtime"

export type ReaderSessionState = {
  activeDocument: ActiveDocumentState
  documents: readonly DocumentSummary[]
  isDocumentLibraryHydrated: boolean
  loadDocumentLibrary: (snapshot: DocumentLibrarySnapshot) => void

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

export const createReaderSessionStore = () =>
  createStore<ReaderSessionState>()((set, get) => ({
    activeDocument: { status: "none" },
    documents: [],
    isDocumentLibraryHydrated: false,
    loadDocumentLibrary: ({ activeDocument, documents }) =>
      set({
        activeDocument,
        currentPage: 1,
        documents,
        isDocumentLibraryHydrated: true,
        pageCount: 0,
      }),

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

    zoom: 1,
    setZoom: (zoom) => set({ scalePreset: null, zoom }),
    reportZoom: (zoom) => set({ zoom }),
    scalePreset: null,
    setScalePreset: (scalePreset) => set({ scalePreset }),

    pageView: "single",
    togglePageView: () =>
      set((state) =>
        state.pageView === "single"
          ? { pageView: "double", scalePreset: "page-fit" }
          : { pageView: "single" },
      ),

    pageLayout: "vertical",
    togglePageLayout: () =>
      set((state) => ({
        pageLayout: state.pageLayout === "vertical" ? "horizontal" : "vertical",
      })),
  }))

export type ReaderSessionStore = ReturnType<typeof createReaderSessionStore>
