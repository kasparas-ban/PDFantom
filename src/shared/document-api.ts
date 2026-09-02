export const OPEN_DOCUMENT_CHANNEL = "document:open"
export const ACTIVATE_DOCUMENT_CHANNEL = "document:activate"
export const GET_DOCUMENT_LIBRARY_CHANNEL = "document:get-library"
export const LOAD_DOCUMENT_CHANNEL = "document:load"

export type DocumentSummary = {
  readonly id: string
  readonly name: string
  readonly fingerprint: string
}

export type OpenedDocument = DocumentSummary & {
  readonly bytes: ArrayBuffer
}

export type DocumentUnavailableReason = "content-mismatch" | "invalid" | "missing" | "unreadable"

export type ActiveDocumentState =
  | { readonly status: "none" }
  | { readonly document: DocumentSummary; readonly status: "loaded" | "preview" }
  | {
      readonly document: DocumentSummary
      readonly reason: DocumentUnavailableReason
      readonly status: "unavailable"
    }

export type DocumentLibrarySnapshot = {
  readonly selectedDocument: DocumentSummary | null
  readonly documents: readonly DocumentSummary[]
}

export type DocumentLoadResult =
  | {
      readonly status: "verified"
      readonly document: DocumentSummary
      readonly bytes?: ArrayBuffer
    }
  | {
      readonly status: "unavailable"
      readonly document: DocumentSummary
      readonly reason: DocumentUnavailableReason
    }

export type DocumentOpenResult = {
  readonly document: OpenedDocument
  readonly previousFingerprint: string | null
  readonly library: DocumentLibrarySnapshot
}

export const documentVersionKey = (document: Pick<DocumentSummary, "id" | "fingerprint">) =>
  `${document.id}:${document.fingerprint}`

export type DocumentApi = {
  activateDocument(
    documentId: string,
    expectedFingerprint: string,
  ): Promise<DocumentLibrarySnapshot>
  loadDocument(
    documentId: string,
    expectedFingerprint: string,
    bytesNeeded: boolean,
  ): Promise<DocumentLoadResult>
  getDocumentLibrary(): Promise<DocumentLibrarySnapshot>
  openDocument(): Promise<DocumentOpenResult | null>
}
