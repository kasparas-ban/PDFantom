import { expect, test } from "@playwright/test"

import {
  DEFAULT_READER_VIEW,
  MAX_PDF_SCALE,
  MIN_PDF_SCALE,
  readingPositionSchema,
  type ReadingPosition,
} from "../../src/renderer/src/reader-model"
import {
  loadReadingPosition,
  saveReadingPosition,
} from "../../src/renderer/src/store/reader-position-storage"

const storageKey = "pdfantom-reading-position:document-1"
const position: ReadingPosition = {
  pageNumber: 4,
  offsetX: -12.125,
  offsetY: 193.375,
  zoom: 1.3,
  scalePreset: null,
  pageLayout: "horizontal",
  pageView: "double",
}

function createStorage(initialValue: string | null = null) {
  const entries = new Map<string, string>()
  const writes: string[] = []
  if (initialValue !== null) entries.set(storageKey, initialValue)
  return {
    writes,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
      writes.push(value)
    },
  }
}

test("the reader model validates finite coordinates, safe page numbers, and view constraints", () => {
  expect(readingPositionSchema.parse(position)).toEqual(position)
  for (const zoom of [MIN_PDF_SCALE, MAX_PDF_SCALE]) {
    expect(readingPositionSchema.safeParse({ ...position, zoom }).success).toBe(true)
  }
  for (const invalidFields of [
    { pageNumber: 0 },
    { pageNumber: 1.5 },
    { pageNumber: Number.MAX_SAFE_INTEGER + 1 },
    { pageNumber: "4" },
    { offsetX: Number.NaN },
    { offsetX: null },
    { offsetY: Number.POSITIVE_INFINITY },
    { offsetY: Number.NEGATIVE_INFINITY },
    { zoom: MIN_PDF_SCALE - 0.01 },
    { zoom: MAX_PDF_SCALE + 0.01 },
    { scalePreset: "automatic" },
    { pageLayout: "diagonal" },
    { pageView: "triple" },
  ]) {
    expect(readingPositionSchema.safeParse({ ...position, ...invalidFields }).success).toBe(false)
  }
})

test("saves the exact position directly and avoids rewriting an unchanged position", () => {
  const storage = createStorage()
  saveReadingPosition(storage, "document-1", position)
  expect(JSON.parse(storage.getItem(storageKey)!)).toEqual(position)
  expect(loadReadingPosition(storage, "document-1")).toEqual(position)
  saveReadingPosition(storage, "document-1", position)
  expect(storage.writes).toHaveLength(1)
})

test("recovers individual view preferences without discarding the location", () => {
  for (const { invalidFields, expectedFields } of [
    { invalidFields: { zoom: 99 }, expectedFields: { zoom: DEFAULT_READER_VIEW.zoom } },
    { invalidFields: { scalePreset: "automatic" }, expectedFields: { scalePreset: null } },
    {
      invalidFields: { pageLayout: "diagonal" },
      expectedFields: { pageLayout: DEFAULT_READER_VIEW.pageLayout },
    },
    {
      invalidFields: { pageView: "triple" },
      expectedFields: { pageView: DEFAULT_READER_VIEW.pageView },
    },
  ]) {
    const storage = createStorage(JSON.stringify({ ...position, ...invalidFields }))
    expect(loadReadingPosition(storage, "document-1")).toEqual({ ...position, ...expectedFields })
  }
})

test("restores a location even when view preferences are missing", () => {
  const location = {
    pageNumber: position.pageNumber,
    offsetX: position.offsetX,
    offsetY: position.offsetY,
  }
  const storage = createStorage(JSON.stringify(location))
  expect(loadReadingPosition(storage, "document-1")).toEqual({
    ...location,
    ...DEFAULT_READER_VIEW,
    scalePreset: null,
  })
})

test("rejects invalid coordinates rather than inventing a reading position", () => {
  for (const invalidFields of [
    { pageNumber: -1 },
    { pageNumber: Number.MAX_SAFE_INTEGER + 1 },
    { offsetX: null },
    { offsetY: "193.375" },
  ]) {
    const storage = createStorage(JSON.stringify({ ...position, ...invalidFields }))
    expect(loadReadingPosition(storage, "document-1")).toBeNull()
    expect(storage.writes).toHaveLength(0)
  }
})

test("handles missing, malformed, and unreadable stored data without blocking opening", () => {
  for (const value of [null, "{broken", "null", "[]", "true", "42", "{}"]) {
    expect(loadReadingPosition(createStorage(value), "document-1")).toBeNull()
  }
  const unavailableStorage = {
    ...createStorage(),
    getItem: () => {
      throw new Error("Storage unavailable")
    },
  }
  expect(loadReadingPosition(unavailableStorage, "document-1")).toBeNull()
})
