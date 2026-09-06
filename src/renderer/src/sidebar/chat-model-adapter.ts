import type { ChatModelAdapter, ChatModelRunResult } from "@assistant-ui/react"

import {
  GENERIC_CHAT_ERROR,
  type ChatApi,
  type ChatEffortLevel,
  type ChatModelSourceId,
  type ChatRequest,
  type ChatStreamEvent,
} from "../../../shared/chat-api"

export type ChatModelSelection = {
  model: string
  effort: ChatEffortLevel
  source: ChatModelSourceId
  supportsEffort: boolean
}

const noop = () => {}

export function createChatModelAdapter(
  platform: Pick<ChatApi, "streamChat">,
  getSelection: () => ChatModelSelection,
) {
  return {
    async *run({ messages, abortSignal }) {
      abortSignal.throwIfAborted()

      const selection = getSelection()
      if (selection.source !== "openrouter") throw new Error(GENERIC_CHAT_ERROR)

      const request: ChatRequest = {
        id: crypto.randomUUID(),
        provider: selection.source,
        model: selection.model,
        ...(selection.supportsEffort && { effort: selection.effort }),
        messages: messages
          .map((message) => ({
            role: message.role,
            content: message.content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n"),
          }))
          .filter((message) => message.content.length > 0),
      }

      yield* streamChatResponse(platform, request, abortSignal)
    },
  } satisfies ChatModelAdapter
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
