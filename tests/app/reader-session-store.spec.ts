import { expect, test } from "@playwright/test"

import type { ReadingPosition } from "../../src/renderer/src/reader-model"
import { createReaderSessionStore } from "../../src/renderer/src/store/reader-session-store"
import { documentVersionKey } from "../../src/shared/document-api"

const first = { id: "first", name: "first.pdf", fingerprint: "a".repeat(64) }
const second = { id: "second", name: "second.pdf", fingerprint: "b".repeat(64) }
const position: ReadingPosition = {
  pageNumber: 4,
  offsetX: -12.125,
  offsetY: 193.375,
  zoom: 1.3,
  scalePreset: null,
  pageLayout: "horizontal",
  pageView: "double",
}

function storage() {
  const records = new Map<string, string>()
  return {
    getItem: (key: string) => records.get(key) ?? null,
    removeItem: (key: string) => {
      records.delete(key)
    },
    setItem: (key: string, value: string) => {
      records.set(key, value)
    },
  }
}

function session() {
  const persistence = storage()
  const store = createReaderSessionStore(persistence)
  store.getState().initializeDocument(first)
  store.getState().reportView(first, { pageCount: 5, interactive: true })
  store.getState().present({ status: "loaded", document: first })
  return { store, persistence }
}

test("owns navigation invariants and disables preview commands", () => {
  const { store } = session()
  expect(store.getState().requestPage(3)).toBe(3)
  for (const page of [99, -1, NaN, 1.5]) expect(store.getState().requestPage(page)).toBe(3)
  store.getState().present({ status: "preview", document: first })
  expect(store.getState().requestPage(4)).toBe(3)
  store.getState().setZoom(2)
  expect(store.getState().zoom).toBe(1)
})

test("metadata hydration does not reset live view and reports are version scoped", () => {
  const { store } = session()
  store.getState().requestPage(4)
  store.getState().setZoom(1.3)
  store.getState().loadDocumentLibrary({ selectedDocument: second, documents: [first, second] })
  store.getState().initializeDocument(second)
  store.getState().reportView(second, { currentPage: 2, pageCount: 20, zoom: 2 })
  expect(store.getState()).toMatchObject({
    currentPage: 4,
    pageCount: 5,
    zoom: 1.3,
    activeDocument: { document: first },
  })
  store.getState().present({ status: "loaded", document: second })
  expect(store.getState()).toMatchObject({ currentPage: 2, pageCount: 20, zoom: 2 })
  store.getState().present({ status: "loaded", document: first })
  expect(store.getState().currentPage).toBe(4)
})

test("persists and restores exact fingerprinted positions", () => {
  const { persistence, store } = session()
  store.getState().reportReadingPosition(first, position)
  const restored = createReaderSessionStore(persistence)
  restored.getState().initializeDocument(first)
  restored.getState().present({ status: "preview", document: first })
  expect(restored.getState()).toMatchObject({
    currentPage: 4,
    initialReadingPosition: position,
    pageLayout: "horizontal",
  })
})

test("replacement rejects old writes and starts at defaults, including after restart", () => {
  const { persistence, store } = session()
  store.getState().reportReadingPosition(first, position)
  const replacement = { ...first, fingerprint: "c".repeat(64) }
  store.getState().replaceVersion(replacement)
  store.getState().reportReadingPosition(first, position)
  store.getState().initializeDocument(replacement)
  expect(store.getState().views[documentVersionKey(first)]).toBeUndefined()
  expect(
    createReaderSessionStore(persistence).getState().initializeDocument(replacement).position,
  ).toBeNull()
})

test("malformed coordinates fall back without blocking opening", () => {
  for (const value of [
    "{broken",
    "null",
    JSON.stringify({ fingerprint: first.fingerprint, ...position, offsetY: "invalid" }),
  ]) {
    const persistence = storage()
    persistence.setItem("pdfantom-reading-position:first", value)
    expect(
      createReaderSessionStore(persistence).getState().initializeDocument(first).position,
    ).toBeNull()
  }
})

test("position saving failures are visible and clear on successful retry", () => {
  const persistence = storage()
  let fail = true
  const store = createReaderSessionStore({
    ...persistence,
    setItem: (key, value) => {
      if (fail) throw new Error("disk")
      persistence.setItem(key, value)
    },
  })
  store.getState().initializeDocument(first)
  store.getState().reportReadingPosition(first, position)
  expect(store.getState().readingPositionError).toContain("could not be saved")
  fail = false
  store.getState().reportReadingPosition(first, position)
  expect(store.getState().readingPositionError).toBeNull()
})
