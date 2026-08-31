import { expect, test } from "@playwright/test"

import type { ReadingPosition } from "../../src/renderer/src/reader-model"
import { createReaderSessionStore } from "../../src/renderer/src/store/reader-session-store"

const createPositionStorage = () => {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
  }
}

const savedPosition: ReadingPosition = {
  pageNumber: 4,
  offsetX: -12.125,
  offsetY: 193.375,
  zoom: 1.3,
  scalePreset: null,
  pageLayout: "horizontal",
  pageView: "double",
}

const documentSnapshot = (id: string) => ({
  activeDocument: {
    document: { bytes: new ArrayBuffer(0), id, name: `${id}.pdf` },
    status: "loaded" as const,
  },
  documents: [{ id, name: `${id}.pdf` }],
})

test("owns page navigation invariants", () => {
  const store = createReaderSessionStore(createPositionStorage())

  store.getState().reportPageCount(5)
  expect(store.getState().requestPage(3)).toBe(3)
  expect(store.getState().currentPage).toBe(3)

  expect(store.getState().requestPage(99)).toBe(3)
  expect(store.getState().requestPage(Number.NaN)).toBe(3)
  expect(store.getState().currentPage).toBe(3)

  store.getState().reportCurrentPage(5)
  expect(store.getState().currentPage).toBe(5)

  store.getState().reportPageCount(2)
  expect(store.getState()).toMatchObject({ currentPage: 2, pageCount: 2 })
})

test("starts an unread document with its own default view", () => {
  const store = createReaderSessionStore(createPositionStorage())
  const document = {
    bytes: new ArrayBuffer(0),
    id: "document-1",
    name: "example.pdf",
  }

  store.getState().setZoom(1.3)
  store.getState().loadDocumentLibrary({
    activeDocument: { document, status: "loaded" },
    documents: [{ id: document.id, name: document.name }],
  })
  store.getState().reportPageCount(5)
  store.getState().requestPage(4)
  store.getState().loadDocumentLibrary({
    activeDocument: {
      document: {
        ...document,
        id: "document-2",
        name: "next.pdf",
      },
      status: "loaded",
    },
    documents: [
      { id: "document-2", name: "next.pdf" },
      { id: document.id, name: document.name },
    ],
  })

  expect(store.getState()).toMatchObject({
    activeDocument: {
      document: { id: "document-2", name: "next.pdf" },
      status: "loaded",
    },
    currentPage: 1,
    documents: [
      { id: "document-2", name: "next.pdf" },
      { id: "document-1", name: "example.pdf" },
    ],
    isDocumentLibraryHydrated: true,
    pageCount: 0,
    scalePreset: "page-fit",
    zoom: 1,
  })
})

test("restores each Document's exact position and view after a new session", () => {
  const storage = createPositionStorage()
  const store = createReaderSessionStore(storage)
  store.getState().loadDocumentLibrary(documentSnapshot("first"))
  store.getState().reportReadingPosition("first", savedPosition)
  store.getState().reportReadingPosition("second", { ...savedPosition, pageNumber: 2 })

  const restored = createReaderSessionStore(storage)
  restored.getState().loadDocumentLibrary(documentSnapshot("first"))
  expect(restored.getState()).toMatchObject({
    currentPage: 4,
    initialReadingPosition: savedPosition,
    pageLayout: "horizontal",
    pageView: "double",
    zoom: 1.3,
    scalePreset: null,
  })
  restored.getState().loadDocumentLibrary(documentSnapshot("second"))
  expect(restored.getState().currentPage).toBe(2)
  restored.getState().loadDocumentLibrary(documentSnapshot("first"))
  restored.getState().reportPageCount(3)
  expect(restored.getState().currentPage).toBe(3)
})

test("ignores malformed saved positions without blocking document opening", () => {
  const storage = createPositionStorage()
  const store = createReaderSessionStore(storage)
  for (const value of [
    "{broken",
    "null",
    JSON.stringify({ ...savedPosition, pageNumber: -1 }),
    JSON.stringify({ ...savedPosition, offsetY: "invalid" }),
  ]) {
    storage.setItem("pdfantom-reading-position:first", value)
    store.getState().loadDocumentLibrary(documentSnapshot("first"))
    expect(store.getState()).toMatchObject({ currentPage: 1, initialReadingPosition: null })
  }
})

test("reports storage failures and clears the error after a successful save", () => {
  const storage = createPositionStorage()
  let fail = true
  const store = createReaderSessionStore({
    ...storage,
    setItem: (key, value) => {
      if (fail) throw new Error("Storage unavailable")
      storage.setItem(key, value)
    },
  })
  store.getState().reportReadingPosition("first", savedPosition)
  expect(store.getState().readingPositionError).toContain("could not be saved")
  fail = false
  store.getState().reportReadingPosition("first", savedPosition)
  expect(store.getState().readingPositionError).toBeNull()
})

test("keeps the saved page when an older view preference needs recovery", () => {
  const storage = createPositionStorage()
  storage.setItem(
    "pdfantom-reading-position:first",
    JSON.stringify({
      ...savedPosition,
      pageLayout: "obsolete-layout",
    }),
  )
  const store = createReaderSessionStore(storage)
  store.getState().loadDocumentLibrary(documentSnapshot("first"))

  expect(store.getState()).toMatchObject({
    currentPage: savedPosition.pageNumber,
    zoom: savedPosition.zoom,
    pageLayout: "vertical",
    initialReadingPosition: { ...savedPosition, pageLayout: "vertical" },
  })
})
