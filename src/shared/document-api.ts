export const OPEN_DOCUMENT_CHANNEL = "document:open"

export type OpenedDocument = {
  readonly bytes: ArrayBuffer
  readonly name: string
}

export type DocumentApi = {
  openDocument(): Promise<OpenedDocument | null>
}
