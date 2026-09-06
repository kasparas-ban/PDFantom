export const GENERATE_CHAT_CHANNEL = "chat:generate"
export const CANCEL_CHAT_CHANNEL = "chat:cancel"
export const LIST_PROVIDER_MODELS_CHANNEL = "chat:list-provider-models"

export const GENERIC_CHAT_ERROR = "Unable to generate response. Please try again later."

export type ChatModelSourceId = "openrouter" | "chatgpt"

export const CHAT_EFFORT_LEVELS = ["low", "medium", "high"] as const

export type ChatEffortLevel = (typeof CHAT_EFFORT_LEVELS)[number]

export const DEFAULT_CHAT_EFFORT: ChatEffortLevel = "medium"

export type ChatRequest = {
  id: string
  model: string
  messages: { role: "user" | "assistant" | "system"; content: string }[]
  effort?: ChatEffortLevel
}

export type ChatResult = { text: string; error?: never } | { error: string; text?: never }

export type ChatModelInfo = {
  id: string
  name: string
  isFree?: boolean
  popularityRank?: number
  supportsReasoning?: boolean
  supportsEffort?: boolean
  supportsImages?: boolean
  outputModalities?: string[]
}

export function isFreeOpenRouterModelId(id: string) {
  return id.toLowerCase().endsWith(":free")
}

export function isTextOutputModel(outputModalities?: string[] | null) {
  return (
    outputModalities?.some((modality) => modality.toLocaleLowerCase() === "text") ?? true
  )
}

export type ChatModelListResult =
  | { models: ChatModelInfo[]; error?: never }
  | { error: string; models?: never }

export type ChatApi = {
  generateChat(request: ChatRequest): Promise<ChatResult>
  cancelChat(id: string): Promise<void>
  listProviderModels(source: ChatModelSourceId): Promise<ChatModelListResult>
}
