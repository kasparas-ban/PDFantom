export const GENERATE_CHAT_CHANNEL = "chat:generate"
export const CANCEL_CHAT_CHANNEL = "chat:cancel"
export const LIST_PROVIDER_MODELS_CHANNEL = "chat:list-provider-models"

export const GENERIC_CHAT_ERROR = "Unable to generate response. Please try again later."

export type ChatModelSourceId = "opencode" | "chatgpt"

export type ChatRequest = {
  id: string
  model: string
  messages: { role: "user" | "assistant" | "system"; content: string }[]
}

export type ChatResult = { text: string; error?: never } | { error: string; text?: never }

export type ChatModelInfo = {
  id: string
  name: string
}

export type ChatModelListResult =
  | { models: ChatModelInfo[]; error?: never }
  | { error: string; models?: never }

export type ChatApi = {
  generateChat(request: ChatRequest): Promise<ChatResult>
  cancelChat(id: string): Promise<void>
  listProviderModels(source: ChatModelSourceId): Promise<ChatModelListResult>
}
