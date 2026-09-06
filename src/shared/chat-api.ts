export const STREAM_CHAT_CHANNEL = "chat:stream"
export const LIST_PROVIDER_MODELS_CHANNEL = "chat:list-provider-models"

export const GENERIC_CHAT_ERROR = "Unable to generate response. Please try again later."

export type ChatModelSourceId = "openrouter" | "chatgpt"

export const CHAT_PROVIDER_IDS = ["openrouter"] as const

export type ChatProviderId = (typeof CHAT_PROVIDER_IDS)[number]

export const CHAT_EFFORT_LEVELS = ["low", "medium", "high"] as const

export type ChatEffortLevel = (typeof CHAT_EFFORT_LEVELS)[number]

export const DEFAULT_CHAT_EFFORT: ChatEffortLevel = "medium"

export type ChatRequest = {
  id: string
  provider: ChatProviderId
  model: string
  messages: { role: "user" | "assistant" | "system"; content: string }[]
  effort?: ChatEffortLevel
}

export type ChatUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type ChatResponseMetadata = {
  provider: ChatProviderId
  model: string
  usage?: ChatUsage
}

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; metadata: ChatResponseMetadata }
  | { type: "error"; message: string }

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
  return outputModalities?.some((modality) => modality.toLocaleLowerCase() === "text") ?? true
}

export type ChatModelListResult =
  | { models: ChatModelInfo[]; error?: never }
  | { error: string; models?: never }

export type ChatApi = {
  streamChat(request: ChatRequest, onEvent: (event: ChatStreamEvent) => void): () => void
  listProviderModels(source: ChatModelSourceId): Promise<ChatModelListResult>
}
