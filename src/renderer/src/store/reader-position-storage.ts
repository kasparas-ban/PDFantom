import {
  DEFAULT_READER_VIEW,
  readingPositionSchema,
  readerViewSchema,
  type ReadingPosition,
} from "../reader-model"

const restorablePositionSchema = readingPositionSchema
  .unwrap()
  .extend({
    zoom: readerViewSchema.shape.zoom.catch(DEFAULT_READER_VIEW.zoom),
    scalePreset: readerViewSchema.shape.scalePreset.catch(null),
    pageLayout: readerViewSchema.shape.pageLayout.catch(DEFAULT_READER_VIEW.pageLayout),
    pageView: readerViewSchema.shape.pageView.catch(DEFAULT_READER_VIEW.pageView),
  })
  .readonly()

export type ReadingPositionStorage = Pick<Storage, "getItem" | "setItem">

const positionKey = (documentId: string) => `pdfantom-reading-position:${documentId}`

export function loadReadingPosition(storage: ReadingPositionStorage, documentId: string) {
  try {
    const value: unknown = JSON.parse(storage.getItem(positionKey(documentId)) ?? "null")
    const result = restorablePositionSchema.safeParse(value)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function saveReadingPosition(
  storage: ReadingPositionStorage,
  documentId: string,
  position: ReadingPosition,
) {
  const key = positionKey(documentId)
  const serialized = JSON.stringify(position)
  if (storage.getItem(key) !== serialized) storage.setItem(key, serialized)
}
