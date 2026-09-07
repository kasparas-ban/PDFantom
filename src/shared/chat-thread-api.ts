import type { ChatModelSourceId, ChatUsage } from "./chat-api"

export const LIST_CHAT_THREADS_CHANNEL = "chat-thread:list"
export const LOAD_CHAT_THREAD_CHANNEL = "chat-thread:load"
export const CREATE_CHAT_THREAD_CHANNEL = "chat-thread:create"
export const APPEND_CHAT_MESSAGE_CHANNEL = "chat-thread:append-message"
export const DELETE_CHAT_THREAD_CHANNEL = "chat-thread:delete"
export const MARK_CHAT_THREAD_VIEWED_CHANNEL = "chat-thread:mark-viewed"

export const CHAT_THREAD_TITLE_MAX_LENGTH = 60

/** The Model, Model Source and effort a Chat Thread last sent a message with. */
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
}

export type ChatThreadMessageStatus =
  | { readonly type: "complete" }
  | { readonly type: "incomplete"; readonly error?: string }

export type ChatThreadMessage = {
  readonly id: string
  readonly role: "user" | "assistant"
  readonly content: string
  readonly status: ChatThreadMessageStatus
  readonly createdAt: string
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
}

/**
 * Appends after `parentId`, discarding anything that followed it. A Chat Thread is
 * linear, so a regenerated reply replaces the one before it.
 */
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
