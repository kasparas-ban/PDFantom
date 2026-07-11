export const OPEN_TEXTBOOK_CHANNEL = "textbook:open"

export type OpenedTextbook = {
  readonly bytes: ArrayBuffer
  readonly name: string
}

export type TextbookApi = {
  openTextbook(): Promise<OpenedTextbook | null>
}
