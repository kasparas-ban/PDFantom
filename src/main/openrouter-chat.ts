import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { APICallError, streamText, type LanguageModelUsage } from "ai"
import { z } from "zod"

import {
  GENERIC_CHAT_ERROR,
  OPENROUTER_EFFORT_LEVELS,
  type ChatRequest,
  type ChatStreamEvent,
  type ChatUsage,
} from "../shared/chat-api"

const providerErrorSchema = z.union([
  z.object({ error: z.object({ message: z.string().trim().min(1).max(2_000) }) }),
  z.object({ message: z.string().trim().min(1).max(2_000) }),
])

export async function* streamOpenRouterChat(
  request: ChatRequest,
  apiKey: string,
  abortSignal: AbortSignal,
  instructions?: string,
) {
  try {
    const openRouter = createOpenRouter({ apiKey, compatibility: "strict" })
    const effort = request.effort && z.enum(OPENROUTER_EFFORT_LEVELS).parse(request.effort)
    const result = streamText({
      model: openRouter.chat(request.model, effort ? { reasoning: { effort } } : undefined),
      ...(instructions && { instructions }),
      messages: request.messages,
      abortSignal,
      timeout: 120_000,
      maxRetries: 0,
    })

    let receivedText = false

    for await (const part of result.stream) {
      switch (part.type) {
        case "text-delta": {
          if (!part.text) break

          receivedText = true
          yield { type: "delta", text: part.text } satisfies ChatStreamEvent
          break
        }
        case "error": {
          throw part.error
        }
        case "finish": {
          if (!receivedText) throw new Error(GENERIC_CHAT_ERROR)

          const usage = normalizeUsage(part.totalUsage)
          yield {
            type: "done",
            metadata: {
              source: "openrouter",
              model: request.model,
              ...(usage && { usage }),
            },
          } satisfies ChatStreamEvent
          return
        }
        case "abort": {
          if (abortSignal.aborted) return

          throw new Error(GENERIC_CHAT_ERROR)
        }
      }
    }

    throw new Error(GENERIC_CHAT_ERROR)
  } catch (error) {
    if (abortSignal.aborted) return

    yield {
      type: "error",
      message: openRouterErrorMessage(error),
    } satisfies ChatStreamEvent
  }
}

function openRouterErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    const providerMessage = parseProviderErrorMessage(error)
    if (providerMessage) return providerMessage
  }

  if (!APICallError.isInstance(error)) return GENERIC_CHAT_ERROR

  const apiMessage = parseProviderErrorMessage(error.data)
  if (apiMessage) return apiMessage

  return parseProviderErrorMessage(safeParseJson(error.responseBody)) ?? GENERIC_CHAT_ERROR
}

function parseProviderErrorMessage(value: unknown) {
  const result = providerErrorSchema.safeParse(value)
  if (!result.success) return undefined

  return "error" in result.data ? result.data.error.message : result.data.message
}

function safeParseJson(value: string | undefined) {
  if (!value) return undefined

  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function normalizeUsage(usage: LanguageModelUsage): ChatUsage | undefined {
  const normalized = {
    ...(usage.inputTokens !== undefined && { inputTokens: usage.inputTokens }),
    ...(usage.outputTokens !== undefined && { outputTokens: usage.outputTokens }),
    ...(usage.totalTokens !== undefined && { totalTokens: usage.totalTokens }),
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}
