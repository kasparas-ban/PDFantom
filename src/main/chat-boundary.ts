import { ipcMain, type BrowserWindow, type IpcMainEvent, type MessagePortMain } from "electron"
import { z } from "zod"

import {
  CHAT_MODEL_SOURCE_IDS,
  GENERIC_CHAT_ERROR,
  STREAM_CHAT_CHANNEL,
  type ChatRequest,
  type ChatStreamEvent,
} from "../shared/chat-api"
import type { ChatThreadRepository } from "./chat-thread-repository"
import type { CodexSession } from "./codex/session"
import type { OpenRouterApiKeyStore } from "./openrouter-api-key-store"
import { streamOpenRouterChat } from "./openrouter-chat"
import { parentContextBlock } from "./side-chat-context"
import { isTrustedRenderer } from "./trusted-renderer"

const requestSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  source: z.enum(CHAT_MODEL_SOURCE_IDS),
  model: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9_./:-]+$/),
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(200),
  effort: z
    .string()
    .regex(/^[a-z]{1,20}$/)
    .optional(),
  parentThreadId: z.uuid().optional(),
})

export function registerChatBoundary(
  window: BrowserWindow,
  rendererUrl: string,
  apiKeyStore: OpenRouterApiKeyStore,
  codexSession: CodexSession,
  chatThreads: ChatThreadRepository,
) {
  const requests = new Map<
    string,
    { controller: AbortController; conversationId: string; port: MessagePortMain }
  >()

  const streamEvents = async function* (request: ChatRequest, signal: AbortSignal) {
    const parentMessages = request.parentThreadId
      ? (chatThreads.loadThread(request.parentThreadId)?.messages ?? [])
      : undefined

    if (request.source === "chatgpt") {
      yield* codexSession.streamChat(request, signal, parentMessages)
      return
    }

    const apiKey = await apiKeyStore.getApiKey()
    if (!apiKey) {
      yield { type: "error", message: "Connect an AI provider" } satisfies ChatStreamEvent
      return
    }

    yield* streamOpenRouterChat(
      request,
      apiKey,
      signal,
      parentMessages && parentContextBlock(parentMessages),
    )
  }

  const handleStream = (event: IpcMainEvent, input: unknown) => {
    const [port] = event.ports
    if (!port) return

    if (!isTrustedRenderer(event, window, rendererUrl)) {
      port.close()
      return
    }

    port.start()

    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) {
      port.postMessage({ type: "error", message: GENERIC_CHAT_ERROR } satisfies ChatStreamEvent)
      return
    }

    const { id, conversationId } = parsed.data
    if ([...requests.values()].some((request) => request.conversationId === conversationId)) {
      port.postMessage({ type: "error", message: GENERIC_CHAT_ERROR } satisfies ChatStreamEvent)
      return
    }

    const controller = new AbortController()
    requests.set(id, { controller, conversationId, port })
    port.once("close", () => controller.abort())

    void (async () => {
      try {
        for await (const streamEvent of streamEvents(parsed.data, controller.signal)) {
          port.postMessage(streamEvent)
        }
      } catch {
        if (controller.signal.aborted) return

        port.postMessage({
          type: "error",
          message: GENERIC_CHAT_ERROR,
        } satisfies ChatStreamEvent)
      } finally {
        requests.delete(id)
      }
    })()
  }

  ipcMain.on(STREAM_CHAT_CHANNEL, handleStream)

  window.webContents.on("destroyed", () => {
    ipcMain.removeListener(STREAM_CHAT_CHANNEL, handleStream)

    for (const { controller, port } of requests.values()) {
      controller.abort()
      port.close()
    }

    requests.clear()
  })

  return {
    abortConversation(conversationId: string) {
      for (const [id, request] of requests) {
        if (request.conversationId !== conversationId) continue

        request.controller.abort()
        request.port.close()
        requests.delete(id)
      }

      codexSession.forgetThread(conversationId)
    },
  }
}
