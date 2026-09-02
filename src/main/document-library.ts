import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import path from "node:path"

import {
  documentVersionKey,
  type DocumentLoadResult,
  type DocumentUnavailableReason,
} from "../shared/document-api"
import { DocumentRepository, type StoredDocument } from "./document-repository"

const PDF_HEADER = "%PDF-"

type LoadedPdf = {
  readonly bytes: ArrayBuffer
  readonly fingerprint: string
}

type DocumentLoader = (sourcePath: string) => Promise<LoadedPdf>

export class DocumentLibrary {
  private readonly inFlight = new Map<string, Promise<LoadedPdf>>()
  private openingGeneration = 0

  constructor(
    private readonly repository: DocumentRepository,
    private readonly loader: DocumentLoader = loadPdf,
  ) {}

  async getSnapshot() {
    const selected = this.repository.getActiveDocument()
    return {
      selectedDocument: selected ? toDocumentSummary(selected) : null,
      documents: this.repository.listDocuments().map(toDocumentSummary),
    }
  }

  async openDocument(sourcePath: string) {
    const generation = ++this.openingGeneration
    const loadedPdf = await this.loader(sourcePath)

    if (generation !== this.openingGeneration) {
      throw new Error("This document opening was superseded.")
    }

    const previousFingerprint = this.repository.findBySourcePath(sourcePath)?.fingerprint ?? null
    const document = this.repository.recordOpenedDocument({
      fingerprint: loadedPdf.fingerprint,
      name: path.basename(sourcePath),
      sourcePath,
    })

    return {
      document: { ...toDocumentSummary(document), bytes: loadedPdf.bytes },
      previousFingerprint,
      library: await this.getSnapshot(),
    }
  }

  async activateDocument(documentId: string, expectedFingerprint: string) {
    const document = this.requireDocument(documentId)
    if (document.fingerprint !== expectedFingerprint) {
      throw new Error("The Document version changed.")
    }

    this.repository.activateDocument(documentId)

    return this.getSnapshot()
  }

  async loadDocument(
    documentId: string,
    expectedFingerprint: string,
    bytesNeeded: boolean,
  ): Promise<DocumentLoadResult> {
    const document = this.requireDocument(documentId)
    const summary = { ...toDocumentSummary(document), fingerprint: expectedFingerprint }

    try {
      if (document.fingerprint !== expectedFingerprint) {
        throw new DocumentUnavailableError("content-mismatch", "The Document version changed.")
      }

      const key = documentVersionKey(document)
      let pending = this.inFlight.get(key)

      if (!pending) {
        pending = this.loader(document.sourcePath)
        this.inFlight.set(key, pending)

        const remove = () => this.inFlight.delete(key)
        void pending.then(remove, remove)
      }

      const loaded = await pending

      if (
        loaded.fingerprint !== document.fingerprint ||
        this.repository.findDocument(documentId)?.fingerprint !== document.fingerprint
      ) {
        throw new DocumentUnavailableError(
          "content-mismatch",
          "The saved Document no longer matches its original content.",
        )
      }

      return {
        status: "verified",
        document: summary,
        ...(bytesNeeded ? { bytes: loaded.bytes } : {}),
      }
    } catch (error) {
      return { status: "unavailable", document: summary, reason: getUnavailableReason(error) }
    }
  }

  private requireDocument(documentId: string) {
    const document = this.repository.findDocument(documentId)
    if (!document) throw new Error("The requested Document does not exist.")

    return document
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
  if (!error || typeof error !== "object" || !("code" in error)) return false

  return typeof error.code === "string"
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
      header = Buffer.concat([header, chunk.subarray(0, PDF_HEADER.length - header.length)])
    }
    chunks.push(chunk)
    hash.update(chunk)
  }

  if (header.toString("ascii") !== PDF_HEADER) {
    throw new DocumentUnavailableError("invalid", "The file does not contain a valid PDF header.")
  }

  return {
    bytes: Uint8Array.from(Buffer.concat(chunks)).buffer,
    fingerprint: hash.digest("hex"),
  }
}

function toDocumentSummary(document: StoredDocument) {
  return { id: document.id, name: document.name, fingerprint: document.fingerprint }
}
