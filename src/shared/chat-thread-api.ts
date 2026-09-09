import type { ChatModelSourceId, ChatUsage } from "./chat-api"

export const LIST_CHAT_THREADS_CHANNEL = "chat-thread:list"
export const LOAD_CHAT_THREAD_CHANNEL = "chat-thread:load"
export const CREATE_CHAT_THREAD_CHANNEL = "chat-thread:create"
export const APPEND_CHAT_MESSAGE_CHANNEL = "chat-thread:append-message"
export const DELETE_CHAT_THREAD_CHANNEL = "chat-thread:delete"
export const MARK_CHAT_THREAD_VIEWED_CHANNEL = "chat-thread:mark-viewed"

export const CHAT_THREAD_TITLE_MAX_LENGTH = 60

export type ChatThreadSelection = {
  readonly model: string
  readonly source: ChatModelSourceId
  readonly effort?: string
}

export type ChatThreadSummary = {
  readonly id: string
  readonly documentId: string
  readonly title: string
  readonly createdAt: string
  readonly lastMessageAt: string
  readonly lastViewedAt: string
  readonly selection: ChatThreadSelection | null
  readonly parentThreadId: string | null
}

export type ChatThreadMessageStatus =
  | { readonly type: "complete" }
  | { readonly type: "incomplete"; readonly error?: string }

export type ChatThreadQuoteSource =
  | { readonly type: "message"; readonly messageId: string }
  | { readonly type: "document"; readonly firstPage: number; readonly lastPage: number }

export type ChatThreadQuote = {
  readonly text: string
  readonly source: ChatThreadQuoteSource
}

export type ChatThreadMessage = {
  readonly id: string
  readonly role: "user" | "assistant"
  readonly content: string
  readonly status: ChatThreadMessageStatus
  readonly createdAt: string
  readonly quotes?: readonly ChatThreadQuote[]
  readonly generation?: {
    readonly source: ChatModelSourceId
    readonly model: string
    readonly usage?: ChatUsage
  }
}

export type LoadedChatThread = {
  readonly thread: ChatThreadSummary
  readonly messages: readonly ChatThreadMessage[]
}

export type CreateChatThreadInput = {
  readonly id: string
  readonly documentId: string
  readonly message: ChatThreadMessage
  readonly selection: ChatThreadSelection
  readonly parentThreadId?: string
}

export type AppendChatMessageInput = {
  readonly threadId: string
  readonly parentId: string | null
  readonly message: ChatThreadMessage
  readonly selection?: ChatThreadSelection
}

export type ChatThreadApi = {
  listChatThreads(): Promise<readonly ChatThreadSummary[]>
  loadChatThread(threadId: string): Promise<LoadedChatThread | null>
  createChatThread(input: CreateChatThreadInput): Promise<ChatThreadSummary>
  appendChatMessage(input: AppendChatMessageInput): Promise<ChatThreadSummary>
  deleteChatThread(threadId: string): Promise<void>
  markChatThreadViewed(threadId: string): Promise<ChatThreadSummary | null>
}

export function deriveChatThreadTitle(text: string) {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find((line) => line.length > 0)
  if (!firstLine) return "New chat"

  if (firstLine.length <= CHAT_THREAD_TITLE_MAX_LENGTH) return firstLine

  const cut = firstLine.slice(0, CHAT_THREAD_TITLE_MAX_LENGTH - 1)
  const lastSpace = cut.lastIndexOf(" ")

  return `${(lastSpace > CHAT_THREAD_TITLE_MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export function compareChatThreadsByActivity(a: ChatThreadSummary, b: ChatThreadSummary) {
  return b.lastMessageAt.localeCompare(a.lastMessageAt) || b.createdAt.localeCompare(a.createdAt)
}

export function parseQuoteSource(value: unknown): ChatThreadQuoteSource | null {
  if (typeof value !== "object" || value === null || !("type" in value)) return null

  if (value.type === "message") {
    return "messageId" in value && typeof value.messageId === "string"
      ? { type: "message", messageId: value.messageId }
      : null
  }

  if (value.type === "document" && "firstPage" in value && "lastPage" in value) {
    const { firstPage, lastPage } = value

    return isPageNumber(firstPage) && isPageNumber(lastPage) && firstPage <= lastPage
      ? { type: "document", firstPage, lastPage }
      : null
  }

  return null
}

function isPageNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
}

export function isSameQuoteSource(a: ChatThreadQuoteSource, b: ChatThreadQuoteSource) {
  return a.type === "message"
    ? b.type === "message" && a.messageId === b.messageId
    : b.type === "document" && a.firstPage === b.firstPage && a.lastPage === b.lastPage
}

export function describeQuotePages(source: ChatThreadQuoteSource) {
  if (source.type !== "document") return null

  return source.firstPage === source.lastPage
    ? `p. ${source.firstPage}`
    : `pp. ${source.firstPage}–${source.lastPage}`
}

function quoteLabel(source: ChatThreadQuoteSource) {
  if (source.type === "message") return "Quoting from the conversation:"

  return source.firstPage === source.lastPage
    ? `Quoting from the document, page ${source.firstPage}:`
    : `Quoting from the document, pages ${source.firstPage}–${source.lastPage}:`
}

export function formatUserMessageContent(text: string, quotes: readonly ChatThreadQuote[]) {
  const blocks = quotes.map(
    (quote) => `${quoteLabel(quote.source)}\n${formatBlockquote(quote.text)}`,
  )
  if (text.trim()) blocks.push(text)

  return blocks.join("\n\n")
}

function formatBlockquote(text: string) {
  return text
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n")
}
