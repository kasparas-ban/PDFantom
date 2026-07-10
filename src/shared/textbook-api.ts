export const OPEN_TEXTBOOK_CHANNEL = "textbook:open"

export interface OpenedTextbook {
  readonly bytes: ArrayBuffer
  readonly name: string
}

export interface TextbookApi {
  openTextbook(): Promise<OpenedTextbook | null>
}
