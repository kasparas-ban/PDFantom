export const OPEN_DOCUMENT_CHANNEL = "document:open"
export const ACTIVATE_DOCUMENT_CHANNEL = "document:activate"
export const GET_DOCUMENT_LIBRARY_CHANNEL = "document:get-library"

export type DocumentSummary = {
  readonly id: string
  readonly name: string
}

export type OpenedDocument = {
  readonly bytes: ArrayBuffer
  readonly id: string
  readonly name: string
}

export type DocumentUnavailableReason =
  | "content-mismatch"
  | "invalid"
  | "missing"
  | "unreadable"

export type ActiveDocumentState =
  | { readonly status: "none" }
  | { readonly document: OpenedDocument; readonly status: "loaded" }
  | {
      readonly document: DocumentSummary
      readonly reason: DocumentUnavailableReason
      readonly status: "unavailable"
    }

export type DocumentLibrarySnapshot = {
  readonly activeDocument: ActiveDocumentState
  readonly documents: readonly DocumentSummary[]
}

export type DocumentApi = {
  activateDocument(documentId: string): Promise<DocumentLibrarySnapshot>
  getDocumentLibrary(): Promise<DocumentLibrarySnapshot>
  openDocument(): Promise<DocumentLibrarySnapshot | null>
}
