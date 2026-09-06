import { ipcMain, type BrowserWindow } from "electron"
import { z } from "zod"

import {
  GENERIC_CHAT_ERROR,
  LIST_PROVIDER_MODELS_CHANNEL,
  isFreeOpenRouterModelId,
  type ChatModelInfo,
  type ChatModelListResult,
} from "../shared/chat-api"
import { isTrustedRenderer } from "./trusted-renderer"

const MODELS_URL = "https://openrouter.ai/api/v1/models?sort=most-popular"
const MODELS_CACHE_TTL_MS = 60 * 60 * 1000
const MODELS_REQUEST_TIMEOUT_MS = 20_000

const priceSchema = z.union([z.string(), z.number()])

const modelSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  pricing: z
    .object({
      prompt: priceSchema,
      completion: priceSchema,
    })
    .optional(),
})

const responseSchema = z.object({
  data: z.array(modelSchema).max(10_000),
})

function isFreeOpenRouterListing(
  id: string,
  pricing?: { prompt: string | number; completion: string | number },
) {
  if (isFreeOpenRouterModelId(id)) return true

  if (!pricing) return false

  return Number(pricing.prompt) === 0 && Number(pricing.completion) === 0
}

type ModelsCache = {
  expiresAt: number
  models: ChatModelInfo[]
}

export function registerChatModelsBoundary(window: BrowserWindow, rendererUrl: string) {
  let cache: ModelsCache | null = null
  let inFlight: Promise<ChatModelListResult> | null = null

  const fetchModels = async (): Promise<ChatModelListResult> => {
    try {
      const response = await fetch(MODELS_URL, {
        signal: AbortSignal.timeout(MODELS_REQUEST_TIMEOUT_MS),
        redirect: "error",
      })

      if (!response.ok) return { error: GENERIC_CHAT_ERROR }

      const body = responseSchema.safeParse(await response.json())
      if (!body.success) return { error: GENERIC_CHAT_ERROR }

      const models: ChatModelInfo[] = body.data.data.map(
        ({ id, name, pricing }, popularityRank) => ({
          id,
          name,
          isFree: isFreeOpenRouterListing(id, pricing),
          popularityRank,
        }),
      )
      cache = { expiresAt: Date.now() + MODELS_CACHE_TTL_MS, models }

      return { models }
    } catch {
      return { error: GENERIC_CHAT_ERROR }
    }
  }

  const loadModels = (): Promise<ChatModelListResult> => {
    if (cache && cache.expiresAt > Date.now()) return Promise.resolve({ models: cache.models })

    if (!inFlight) {
      inFlight = fetchModels().finally(() => {
        inFlight = null
      })
    }

    return inFlight
  }

  ipcMain.handle(
    LIST_PROVIDER_MODELS_CHANNEL,
    async (event, source: unknown): Promise<ChatModelListResult> => {
      if (!isTrustedRenderer(event, window, rendererUrl)) {
        throw new Error("Chat model list access was denied for an untrusted sender.")
      }

      // Only OpenRouter currently has a live listing. Every other source resolves to
      // its bundled catalog on the renderer side.
      if (source !== "openrouter") return { models: [] }

      return loadModels()
    },
  )
}
