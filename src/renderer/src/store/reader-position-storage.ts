import type { DocumentSummary } from "../../../shared/document-api"
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

export function loadReadingPosition(
  storage: ReadingPositionStorage,
  document: Pick<DocumentSummary, "id" | "fingerprint">,
  allowLegacy = false,
) {
  try {
    const value: unknown = JSON.parse(storage.getItem(positionKey(document.id)) ?? "null")
    if (!value || typeof value !== "object") return null

    if ("fingerprint" in value || "schema" in value) {
      if (
        !("schema" in value) ||
        value.schema !== 1 ||
        !("fingerprint" in value) ||
        value.fingerprint !== document.fingerprint
      ) {
        return null
      }
    } else if (!allowLegacy) return null

    const result = restorablePositionSchema.safeParse(value)

    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function saveReadingPosition(
  storage: ReadingPositionStorage,
  document: Pick<DocumentSummary, "id" | "fingerprint">,
  position: ReadingPosition | null,
) {
  const key = positionKey(document.id)
  const serialized = JSON.stringify({ schema: 1, fingerprint: document.fingerprint, ...position })
  if (storage.getItem(key) !== serialized) storage.setItem(key, serialized)
}
