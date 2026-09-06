import { ipcMain, type BrowserWindow, type IpcMainEvent, type MessagePortMain } from "electron"
import { z } from "zod"

import {
  CHAT_EFFORT_LEVELS,
  CHAT_PROVIDER_IDS,
  GENERIC_CHAT_ERROR,
  STREAM_CHAT_CHANNEL,
  type ChatStreamEvent,
} from "../shared/chat-api"
import type { OpenRouterApiKeyStore } from "./openrouter-api-key-store"
import { streamOpenRouterChat } from "./openrouter-chat"
import { isTrustedRenderer } from "./trusted-renderer"

const requestSchema = z.object({
  id: z.uuid(),
  provider: z.enum(CHAT_PROVIDER_IDS),
  model: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9_./:-]+$/),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(200),
  effort: z.enum(CHAT_EFFORT_LEVELS).optional(),
})

export function registerChatBoundary(
  window: BrowserWindow,
  rendererUrl: string,
  apiKeyStore: OpenRouterApiKeyStore,
) {
  const requests = new Map<string, { controller: AbortController; port: MessagePortMain }>()

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

    const { id } = parsed.data
    if (requests.size > 0) {
      port.postMessage({ type: "error", message: GENERIC_CHAT_ERROR } satisfies ChatStreamEvent)
      return
    }

    const controller = new AbortController()
    requests.set(id, { controller, port })
    port.once("close", () => controller.abort())

    void (async () => {
      try {
        const apiKey = await apiKeyStore.getApiKey()
        if (!apiKey) {
          port.postMessage({
            type: "error",
            message: "Connect an AI provider",
          } satisfies ChatStreamEvent)
          return
        }

        for await (const streamEvent of streamOpenRouterChat(
          parsed.data,
          apiKey,
          controller.signal,
        )) {
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
}
