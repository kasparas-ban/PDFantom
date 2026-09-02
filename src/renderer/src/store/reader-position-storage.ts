import { z } from "zod"

import type { DocumentSummary } from "../../../shared/document-api"
import { readingPositionSchema, type ReadingPosition } from "../reader-model"

export type ReadingPositionStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

const positionKey = (documentId: string) => `pdfantom-reading-position:${documentId}`
const storedReadingPositionSchema = z
  .object({ fingerprint: z.string(), ...readingPositionSchema.unwrap().shape })
  .strict()

export function loadReadingPosition(
  storage: ReadingPositionStorage,
  document: Pick<DocumentSummary, "id" | "fingerprint">,
) {
  try {
    const value: unknown = JSON.parse(storage.getItem(positionKey(document.id)) ?? "null")
    const result = storedReadingPositionSchema.safeParse(value)
    if (!result.success || result.data.fingerprint !== document.fingerprint) return null

    return readingPositionSchema.parse(result.data)
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
  if (!position) {
    storage.removeItem(key)
    return
  }

  const serialized = JSON.stringify({ fingerprint: document.fingerprint, ...position })
  if (storage.getItem(key) !== serialized) storage.setItem(key, serialized)
}
