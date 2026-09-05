import { ipcMain, type BrowserWindow } from "electron"
import { z } from "zod"

import {
  CANCEL_CHAT_CHANNEL,
  GENERATE_CHAT_CHANNEL,
  GENERIC_CHAT_ERROR,
  type ChatResult,
} from "../shared/chat-api"
import type { OpenRouterApiKeyStore } from "./openrouter-api-key-store"
import { isTrustedRenderer } from "./trusted-renderer"

const requestSchema = z.object({
  id: z.uuid(),
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
})
const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
})

const errorResponseSchema = z.object({
  error: z.object({ message: z.string().trim().min(1).max(2_000) }),
})

export function registerChatBoundary(
  window: BrowserWindow,
  rendererUrl: string,
  apiKeyStore: OpenRouterApiKeyStore,
) {
  const requests = new Map<string, AbortController>()

  ipcMain.handle(GENERATE_CHAT_CHANNEL, async (event, input: unknown): Promise<ChatResult> => {
    if (!isTrustedRenderer(event, window, rendererUrl)) {
      throw new Error("Chat access was denied for an untrusted sender.")
    }

    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return { error: GENERIC_CHAT_ERROR }

    const { id, model, messages } = parsed.data
    if (requests.size > 0) return { error: GENERIC_CHAT_ERROR }

    const controller = new AbortController()
    requests.set(id, controller)

    try {
      const apiKey = await apiKeyStore.getApiKey()
      if (!apiKey) return { error: "Connect an AI provider" }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]),
        redirect: "error",
      })

      if (!response.ok) {
        const body = errorResponseSchema.safeParse(await response.json())
        return { error: body.success ? body.data.error.message : GENERIC_CHAT_ERROR }
      }

      const body = responseSchema.safeParse(await response.json())
      if (!body.success) return { error: GENERIC_CHAT_ERROR }

      return { text: body.data.choices[0].message.content }
    } catch {
      return { error: GENERIC_CHAT_ERROR }
    } finally {
      requests.delete(id)
    }
  })

  ipcMain.handle(CANCEL_CHAT_CHANNEL, (event, id: unknown) => {
    if (!isTrustedRenderer(event, window, rendererUrl)) {
      throw new Error("Chat access was denied for an untrusted sender.")
    }

    if (typeof id === "string") requests.get(id)?.abort()
  })

  window.webContents.on("destroyed", () => {
    for (const controller of requests.values()) controller.abort()
    requests.clear()
  })
}
