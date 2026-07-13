import { expect, test } from "@playwright/test"

import { createReaderSessionStore } from "../../src/renderer/src/store/reader-session-store"

test("owns page navigation invariants", () => {
  const store = createReaderSessionStore()

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

test("starts each document with a fresh navigation session", () => {
  const store = createReaderSessionStore()
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
    zoom: 1.3,
  })
})
