import type { ChatModelRunOptions, ChatModelRunResult, ThreadMessage } from "@assistant-ui/react"

import {
  GENERIC_CHAT_ERROR,
  type ChatApi,
  type ChatModelSourceId,
  type ChatRequest,
  type ChatStreamEvent,
} from "../../../shared/chat-api"
import { formatUserMessageContent, readQuoteAttachments } from "./chat-quote"

export type ChatModelSelection = {
  model: string
  effort?: string
  source: ChatModelSourceId
}

const noop = () => {}

export function createChatModelAdapter(
  platform: Pick<ChatApi, "streamChat">,
  getSelection: () => ChatModelSelection,
  conversationId: string,
) {
  let interruptController = new AbortController()

  return {
    interrupt: () => {
      interruptController.abort(new DOMException("The chat response was interrupted", "AbortError"))
    },
    async *run({ messages, abortSignal }: ChatModelRunOptions) {
      abortSignal.throwIfAborted()
      interruptController = new AbortController()

      const selection = getSelection()
      const request: ChatRequest = {
        id: crypto.randomUUID(),
        conversationId,
        source: selection.source,
        model: selection.model,
        ...(selection.effort && { effort: selection.effort }),
        messages: messages
          .map((message) => ({
            id: message.id,
            role: message.role,
            content: resolveRequestContent(message),
          }))
          .filter((message) => message.content.length > 0),
      }

      yield* streamChatResponse(
        platform,
        request,
        AbortSignal.any([abortSignal, interruptController.signal]),
      )
    },
  }
}

function resolveRequestContent(message: ThreadMessage) {
  const text = message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
  if (message.role !== "user") return text

  return formatUserMessageContent(text, readQuoteAttachments(message.attachments))
}

export async function* streamChatResponse(
  platform: Pick<ChatApi, "streamChat">,
  request: ChatRequest,
  abortSignal: AbortSignal,
) {
  const abortListenerController = new AbortController()
  let stopTransport = noop

  const events = new ReadableStream<ChatStreamEvent>({
    start(controller) {
      let settled = false

      const handleAbort = () => {
        if (settled) return

        settled = true
        stopTransport()
        controller.error(
          abortSignal.reason ?? new DOMException("The chat response was stopped", "AbortError"),
        )
      }

      abortSignal.addEventListener("abort", handleAbort, {
        once: true,
        signal: abortListenerController.signal,
      })

      try {
        stopTransport = platform.streamChat(request, (event) => {
          if (settled) return

          controller.enqueue(event)
          if (event.type === "delta") return

          settled = true
          controller.close()
        })
      } catch {
        settled = true
        abortListenerController.abort()
        controller.error(new Error(GENERIC_CHAT_ERROR))
      }

      if (abortSignal.aborted) handleAbort()
    },
    cancel() {
      stopTransport()
    },
  })

  let fullText = ""

  try {
    for await (const event of events) {
      switch (event.type) {
        case "delta": {
          fullText += event.text
          yield {
            content: [{ type: "text", text: fullText }],
          } satisfies ChatModelRunResult
          break
        }
        case "done": {
          yield {
            content: [{ type: "text", text: fullText }],
            metadata: { custom: { generation: event.metadata } },
          } satisfies ChatModelRunResult
          return
        }
        case "error": {
          throw new Error(event.message)
        }
        default: {
          assertNever(event)
        }
      }
    }
  } finally {
    abortListenerController.abort()
    stopTransport()
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected chat stream event: ${JSON.stringify(value)}`)
}
