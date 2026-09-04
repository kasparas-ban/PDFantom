import { z } from "zod"

import { documentVersionKey, type DocumentSummary } from "../../shared/document-api"
import { readingPositionSchema, type ReadingPosition } from "./reader-model"

const DATABASE = "pdfantom-reader-previews"
const STORE = "viewports"
export const PREVIEW_LIMIT = 20
export const PREVIEW_BYTE_LIMIT = 32 * 1024 * 1024
const MAX_DIMENSION = 8192
const MAX_AREA = 16 * 1024 * 1024

export type ViewportAppearance = {
  width: number
  height: number
  density: number
  background: string
}

export type ReaderPreview = ViewportAppearance & {
  key: string
  documentId: string
  fingerprint: string
  blob: Blob
  bytes: number
  position: ReadingPosition
  pageCount: number
  generation: string
  revision: number
  lastUsed: number
}

const previewRecordSchema = z
  .object({
    key: z.string(),
    documentId: z.string(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    blob: z.instanceof(Blob),
    bytes: z.int().positive().max(PREVIEW_BYTE_LIMIT),
    position: readingPositionSchema,
    pageCount: z.int().positive(),
    generation: z.string(),
    revision: z.int().nonnegative(),
    lastUsed: z.number().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive(),
    density: z.number().positive().max(2),
    background: z.string(),
  })
  .strict()

const validRecord = (value: unknown) => {
  const result = previewRecordSchema.safeParse(value)
  return (
    result.success &&
    safeViewport(result.data) &&
    result.data.blob.size === result.data.bytes &&
    result.data.blob.type === "image/png"
  )
}

export function safeViewport({ width, height, density }: ViewportAppearance) {
  if (
    ![width, height, density].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    density <= 0 ||
    density > 2
  ) {
    return false
  }

  const pixelWidth = Math.ceil(width * density)
  const pixelHeight = Math.ceil(height * density)

  return (
    pixelWidth <= MAX_DIMENSION &&
    pixelHeight <= MAX_DIMENSION &&
    pixelWidth * pixelHeight <= MAX_AREA
  )
}

export function sameAppearance(first: ViewportAppearance | null, second: ViewportAppearance) {
  if (!first) return false

  return (
    first.width === second.width &&
    first.height === second.height &&
    first.density === second.density &&
    first.background === second.background
  )
}

export function viewportAppearance(element: HTMLElement) {
  return {
    width: element.clientWidth,
    height: element.clientHeight,
    density: Math.min(devicePixelRatio, 2),
    background: getComputedStyle(element).backgroundColor,
  }
}

export const samePosition = (first: ReadingPosition | null, second: ReadingPosition | null) =>
  first !== null &&
  second !== null &&
  (
    ["pageNumber", "offsetX", "offsetY", "zoom", "scalePreset", "pageLayout", "pageView"] as const
  ).every((key) => first[key] === second[key])

export function compatiblePreview(
  value: ReaderPreview,
  document: DocumentSummary,
  position: ReadingPosition | null,
  appearance: ViewportAppearance,
) {
  return (
    validRecord(value) &&
    value.key === documentVersionKey(document) &&
    value.documentId === document.id &&
    value.fingerprint === document.fingerprint &&
    Number.isSafeInteger(value.pageCount) &&
    samePosition(value.position, position) &&
    safeViewport(appearance) &&
    sameAppearance(value, appearance)
  )
}

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result))
    request.addEventListener("error", () => reject(request.error))
  })

const transactionDone = (transaction: IDBTransaction) => {
  const done = new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve())
    transaction.addEventListener("error", () => reject(transaction.error))
    transaction.addEventListener("abort", () => reject(transaction.error))
  })
  // A request may fail before its caller gets to await the transaction.
  void done.catch(() => undefined)

  return done
}

// Disposable local images only. The authoritative position remains in localStorage.
export class ReaderPreviewCache {
  private connection: Promise<IDBDatabase> | null = null
  private disposed = false
  private revision = 0
  private readonly generation = crypto.randomUUID()
  private readonly epochs = new Map<string, number>()

  private database() {
    this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1)
      request.addEventListener("upgradeneeded", () =>
        request.result.createObjectStore(STORE, { keyPath: "key" }),
      )
      request.addEventListener("error", () => reject(request.error))
      request.addEventListener("blocked", () => reject(new Error("Preview storage is busy.")))
      request.addEventListener("success", () => {
        const database = request.result

        database.onversionchange = () => database.close()
        if (this.disposed) database.close()

        resolve(database)
      })
    })

    return this.connection
  }

  ticket(document: DocumentSummary) {
    const key = documentVersionKey(document)
    const epoch = this.epochs.get(key) ?? 0

    return {
      generation: this.generation,
      revision: ++this.revision,
      valid: () => !this.disposed && (this.epochs.get(key) ?? 0) === epoch,
    }
  }

  async read(
    document: DocumentSummary,
    position: ReadingPosition | null,
    appearance: ViewportAppearance,
  ) {
    const ticket = this.ticket(document)
    try {
      const database = await this.database()
      const transaction = database.transaction(STORE, "readwrite")
      const done = transactionDone(transaction)
      const store = transaction.objectStore(STORE)
      const record: ReaderPreview | undefined = await requestResult(
        store.get(documentVersionKey(document)),
      )

      if (record && compatiblePreview(record, document, position, appearance) && ticket.valid()) {
        store.put({ ...record, lastUsed: Date.now() })
        await done
        return ticket.valid() ? record : null
      }

      if (record && !validRecord(record)) store.delete(record.key)

      await done
    } catch {
      /* A cache miss must never prevent reading. */
    }
    return null
  }

  async write(record: ReaderPreview, eligible: () => boolean) {
    try {
      if (!eligible() || this.disposed || !validRecord(record)) return

      const database = await this.database()
      if (!eligible() || this.disposed) return

      const transaction = database.transaction(STORE, "readwrite")
      const done = transactionDone(transaction)
      const store = transaction.objectStore(STORE)
      const records: ReaderPreview[] = await requestResult(store.getAll())
      const previous = records.find(({ key }) => key === record.key)

      if (
        !eligible() ||
        (previous?.generation === record.generation && previous.revision >= record.revision)
      ) {
        await done
        return
      }

      store.put(record)

      const retained = records.filter((value) => {
        const obsolete =
          !validRecord(value) ||
          (value.documentId === record.documentId && value.fingerprint !== record.fingerprint)
        if (obsolete) store.delete(value.key)
        return !obsolete && value.key !== record.key
      })

      retained.push(record)
      retained.sort((a, b) => a.lastUsed - b.lastUsed)

      let bytes = retained.reduce((total, value) => total + value.bytes, 0)

      while (retained.length > PREVIEW_LIMIT || bytes > PREVIEW_BYTE_LIMIT) {
        const oldest = retained.shift()!
        bytes -= oldest.bytes
        store.delete(oldest.key)
      }

      await done

      // Remove this stale capture, never a newer capture that committed meanwhile.
      if (!eligible()) {
        const cleanup = database.transaction(STORE, "readwrite")
        const cleaned = transactionDone(cleanup)
        const cache = cleanup.objectStore(STORE)
        const current: ReaderPreview | undefined = await requestResult(cache.get(record.key))

        if (current?.generation === record.generation && current.revision === record.revision) {
          cache.delete(record.key)
        }

        await cleaned
      }
    } catch {
      /* Quota, encoding and disk errors are non-fatal. */
    }
  }

  async invalidate(document: Pick<DocumentSummary, "id" | "fingerprint">) {
    const key = documentVersionKey(document)
    this.epochs.set(key, (this.epochs.get(key) ?? 0) + 1)

    try {
      const database = await this.database()
      const transaction = database.transaction(STORE, "readwrite")
      const done = transactionDone(transaction)
      transaction.objectStore(STORE).delete(key)
      await done
    } catch {
      /* Best effort; version/position compatibility still applies. */
    }
  }

  dispose() {
    this.disposed = true
    void this.connection?.then(
      (database) => database.close(),
      () => undefined,
    )
  }
}

export async function capturePreview(container: HTMLElement, appearance: ViewportAppearance) {
  if (!safeViewport(appearance)) return null

  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(appearance.width * appearance.density)
  canvas.height = Math.ceil(appearance.height * appearance.density)

  const context = canvas.getContext("2d")
  if (!context) return null

  context.scale(appearance.density, appearance.density)
  context.fillStyle = appearance.background
  context.fillRect(0, 0, appearance.width, appearance.height)

  const bounds = container.getBoundingClientRect()

  for (const page of container.querySelectorAll<HTMLCanvasElement>(".page canvas")) {
    const rect = page.getBoundingClientRect()
    if (
      !page.width ||
      !page.height ||
      rect.bottom <= bounds.top ||
      rect.top >= bounds.bottom ||
      rect.right <= bounds.left ||
      rect.left >= bounds.right ||
      getComputedStyle(page).visibility === "hidden"
    ) {
      continue
    }

    context.drawImage(page, rect.left - bounds.left, rect.top - bounds.top, rect.width, rect.height)
  }

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((blob) => {
      canvas.width = canvas.height = 0
      resolve(blob)
    }, "image/png"),
  )
}

export async function decodePreview(record: ReaderPreview) {
  const url = URL.createObjectURL(record.blob)
  const image = new Image()

  image.src = url

  try {
    await image.decode()
    if (
      image.naturalWidth !== Math.ceil(record.width * record.density) ||
      image.naturalHeight !== Math.ceil(record.height * record.density)
    ) {
      throw new Error("Invalid preview dimensions")
    }

    return { image, dispose: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}
