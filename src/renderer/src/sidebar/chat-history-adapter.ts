import {
  ExportedMessageRepository,
  type ExportedMessageRepositoryItem,
  type ThreadHistoryAdapter,
  type ThreadMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react"

import { CHAT_MODEL_SOURCE_IDS, type ChatModelSourceId } from "../../../shared/chat-api"
import type {
  ChatThreadApi,
  ChatThreadMessage,
  ChatThreadSelection,
  ChatThreadSummary,
} from "../../../shared/chat-thread-api"
import { readQuoteAttachments, toCompleteQuoteAttachment } from "./chat-quote"

type ChatHistoryAdapterOptions = {
  readonly platform: Pick<ChatThreadApi, "loadChatThread" | "createChatThread" | "appendChatMessage">
  readonly threadId: string
  readonly documentId: string | null
  readonly isDraft: boolean
  readonly getSelection: () => ChatThreadSelection
  readonly onThreadChanged: (thread: ChatThreadSummary) => void
}

export function createChatHistoryAdapter({
  platform,
  threadId,
  documentId,
  isDraft,
  getSelection,
  onThreadChanged,
}: ChatHistoryAdapterOptions): ThreadHistoryAdapter {
  let created = !isDraft
  let pending: Promise<unknown> = Promise.resolve()

  const write = async (item: ExportedMessageRepositoryItem) => {
    const message = toChatThreadMessage(item.message)
    if (!message) return

    if (!created) {
      if (message.role !== "user" || documentId === null) return

      created = true
      onThreadChanged(
        await platform.createChatThread({
          id: threadId,
          documentId,
          message,
          selection: getSelection(),
        }),
      )
      return
    }

    onThreadChanged(
      await platform.appendChatMessage({
        threadId,
        parentId: item.parentId,
        message,
        ...(message.role === "user" && { selection: getSelection() }),
      }),
    )
  }

  return {
    async load() {
      if (!created) return { messages: [] }

      const loaded = await platform.loadChatThread(threadId)
      if (!loaded) {
        created = false
        return { messages: [] }
      }

      return ExportedMessageRepository.fromArray(loaded.messages.map(toThreadMessageLike))
    },
    append(item) {
      const next = pending.then(() => write(item))
      pending = next.catch(() => undefined)

      return next
    },
  }
}

export function toChatThreadMessage(message: ThreadMessage): ChatThreadMessage | null {
  if (message.role === "system") return null

  const content = message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")

  if (message.role === "user") {
    const quotes = readQuoteAttachments(message.attachments)

    return {
      id: message.id,
      role: "user",
      content,
      status: { type: "complete" },
      createdAt: message.createdAt.toISOString(),
      ...(quotes.length > 0 && { quotes }),
    }
  }

  const generation = readGeneration(message.metadata.custom?.generation)

  return {
    id: message.id,
    role: "assistant",
    content,
    status:
      message.status.type === "complete"
        ? { type: "complete" }
        : { type: "incomplete", ...(errorText(message.status) && { error: errorText(message.status) }) },
    createdAt: message.createdAt.toISOString(),
    ...(generation && { generation }),
  }
}

export function toThreadMessageLike(message: ChatThreadMessage): ThreadMessageLike {
  const base = {
    id: message.id,
    createdAt: new Date(message.createdAt),
    content: [{ type: "text" as const, text: message.content }],
  }

  if (message.role === "user") {
    return {
      ...base,
      role: "user",
      attachments: (message.quotes ?? []).map((quote, index) =>
        toCompleteQuoteAttachment(quote, `${message.id}:quote:${index}`),
      ),
    }
  }

  return {
    ...base,
    role: "assistant",
    status:
      message.status.type === "complete"
        ? { type: "complete", reason: "unknown" }
        : {
            type: "incomplete",
            reason: message.status.error ? "error" : "cancelled",
            ...(message.status.error && { error: message.status.error }),
          },
    ...(message.generation && { metadata: { custom: { generation: message.generation } } }),
  }
}

function errorText(status: ThreadMessage["status"]) {
  if (!status || status.type !== "incomplete" || status.error === undefined) return undefined

  const error: unknown = status.error
  if (typeof error === "string") return error
  if (typeof error === "object" && error !== null && "message" in error) {
    return typeof error.message === "string" ? error.message : undefined
  }

  return undefined
}

function readGeneration(value: unknown): ChatThreadMessage["generation"] | undefined {
  if (typeof value !== "object" || value === null) return undefined

  const { source, model, usage } = value as {
    source?: unknown
    model?: unknown
    usage?: unknown
  }
  if (typeof model !== "string" || !isModelSource(source)) return undefined

  return {
    source,
    model,
    ...(typeof usage === "object" && usage !== null && { usage: readUsage(usage) }),
  }
}

function isModelSource(value: unknown): value is ChatModelSourceId {
  return typeof value === "string" && (CHAT_MODEL_SOURCE_IDS as readonly string[]).includes(value)
}

function readUsage(value: object) {
  const { inputTokens, outputTokens, totalTokens } = value as {
    inputTokens?: unknown
    outputTokens?: unknown
    totalTokens?: unknown
  }

  return {
    ...(typeof inputTokens === "number" && { inputTokens }),
    ...(typeof outputTokens === "number" && { outputTokens }),
    ...(typeof totalTokens === "number" && { totalTokens }),
  }
}
