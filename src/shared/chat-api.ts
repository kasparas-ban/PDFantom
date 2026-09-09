export const STREAM_CHAT_CHANNEL = "chat:stream"
export const LIST_MODELS_CHANNEL = "chat:list-models"

export const GENERIC_CHAT_ERROR = "Unable to generate response. Please try again later."

export const CHAT_MODEL_SOURCE_IDS = ["openrouter", "chatgpt"] as const

export type ChatModelSourceId = (typeof CHAT_MODEL_SOURCE_IDS)[number]

export const OPENROUTER_EFFORT_LEVELS = ["low", "medium", "high"] as const

export const DEFAULT_CHAT_EFFORT = "medium"

export type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
}

export type ChatRequest = {
  id: string
  conversationId: string
  source: ChatModelSourceId
  model: string
  messages: ChatMessage[]
  effort?: string
  parentThreadId?: string
}

export type ChatUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type ChatResponseMetadata = {
  source: ChatModelSourceId
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
  effortLevels?: readonly string[]
  supportsImages?: boolean
  outputModalities?: string[]
}

export function isFreeOpenRouterModelId(id: string) {
  return id.toLowerCase().endsWith(":free")
}

export function isTextOnlyOutputModel(outputModalities?: string[] | null) {
  return outputModalities?.length === 1 && outputModalities[0].toLocaleLowerCase() === "text"
}

export type ChatModelListResult =
  | { models: ChatModelInfo[]; unavailableReason?: string; error?: never }
  | { error: string; models?: never }

export type ChatApi = {
  streamChat(request: ChatRequest, onEvent: (event: ChatStreamEvent) => void): () => void
  listModels(source: ChatModelSourceId): Promise<ChatModelListResult>
}
