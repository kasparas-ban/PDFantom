import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import path from "node:path"

import type {
  ActiveDocumentState,
  DocumentUnavailableReason,
  OpenedDocument,
} from "../shared/document-api"
import { DocumentRepository, type StoredDocument } from "./document-repository"

const PDF_HEADER = "%PDF-"

type LoadedPdf = {
  readonly bytes: ArrayBuffer
  readonly fingerprint: string
}

type DocumentLoader = (sourcePath: string) => Promise<LoadedPdf>

export class DocumentLibrary {
  private commandQueue = Promise.resolve()

  constructor(
    private readonly repository: DocumentRepository,
    private readonly loadDocument: DocumentLoader = loadPdf,
  ) {}

  getSnapshot() {
    return this.enqueue(() => this.createSnapshot())
  }

  openDocument(sourcePath: string) {
    return this.enqueue(async () => {
      const loadedPdf = await this.loadDocument(sourcePath)
      const document = this.repository.recordOpenedDocument({
        fingerprint: loadedPdf.fingerprint,
        name: path.basename(sourcePath),
        sourcePath,
      })

      return this.createSnapshot(toOpenedDocument(document, loadedPdf.bytes))
    })
  }

  activateDocument(documentId: string) {
    return this.enqueue(async () => {
      const storedDocument = this.repository.findDocument(documentId)
      if (!storedDocument) throw new Error("The requested Document does not exist.")

      const openedDocument = await this.loadStoredDocument(storedDocument)
      const activeDocument = this.repository.activateDocument(documentId)

      return this.createSnapshot(toOpenedDocument(activeDocument, openedDocument.bytes))
    })
  }

  private enqueue<T>(command: () => Promise<T>) {
    const result = this.commandQueue.then(command)
    this.commandQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private async createSnapshot(loadedActiveDocument?: OpenedDocument) {
    let activeDocument: ActiveDocumentState = loadedActiveDocument
      ? { document: loadedActiveDocument, status: "loaded" }
      : { status: "none" }

    if (!loadedActiveDocument) {
      const storedActiveDocument = this.repository.getActiveDocument()
      if (storedActiveDocument) {
        try {
          activeDocument = {
            document: await this.loadStoredDocument(storedActiveDocument),
            status: "loaded",
          }
        } catch (error) {
          activeDocument = {
            document: toDocumentSummary(storedActiveDocument),
            reason: getUnavailableReason(error),
            status: "unavailable",
          }
        }
      }
    }

    const documents = this.repository
      .listDocuments()
      .map(({ id, name }) => ({ id, name }))

    return { activeDocument, documents }
  }

  private async loadStoredDocument(document: StoredDocument) {
    const loadedPdf = await this.loadDocument(document.sourcePath)
    if (loadedPdf.fingerprint !== document.fingerprint) {
      throw new DocumentUnavailableError(
        "content-mismatch",
        "The saved Document no longer matches its original content.",
      )
    }

    return toOpenedDocument(document, loadedPdf.bytes)
  }
}

class DocumentUnavailableError extends Error {
  constructor(
    readonly reason: DocumentUnavailableReason,
    message: string,
  ) {
    super(message)
  }
}

function getUnavailableReason(error: unknown) {
  if (error instanceof DocumentUnavailableError) return error.reason
  if (hasErrorCode(error) && error.code === "ENOENT") return "missing" as const
  return "unreadable" as const
}

function hasErrorCode(error: unknown): error is { readonly code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  )
}

async function loadPdf(filePath: string) {
  if (path.extname(filePath).toLowerCase() !== ".pdf") {
    throw new DocumentUnavailableError("invalid", "The file is not a PDF.")
  }

  const chunks = new Array<Buffer>()
  const hash = createHash("sha256")
  let header = Buffer.alloc(0)

  for await (const chunk of createReadStream(filePath)) {
    if (header.length < PDF_HEADER.length) {
      header = Buffer.concat([
        header,
        chunk.subarray(0, PDF_HEADER.length - header.length),
      ])
    }
    chunks.push(chunk)
    hash.update(chunk)
  }

  if (header.toString("ascii") !== PDF_HEADER) {
    throw new DocumentUnavailableError(
      "invalid",
      "The file does not contain a valid PDF header.",
    )
  }

  return {
    bytes: Uint8Array.from(Buffer.concat(chunks)).buffer,
    fingerprint: hash.digest("hex"),
  }
}

function toOpenedDocument(document: StoredDocument, bytes: ArrayBuffer) {
  return {
    bytes,
    id: document.id,
    name: document.name,
  }
}

function toDocumentSummary(document: StoredDocument) {
  return { id: document.id, name: document.name }
}
