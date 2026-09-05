export const GENERATE_CHAT_CHANNEL = "chat:generate"
export const CANCEL_CHAT_CHANNEL = "chat:cancel"

export const GENERIC_CHAT_ERROR = "Unable to generate response. Please try again later."

export type ChatRequest = {
  id: string
  model: string
  messages: { role: "user" | "assistant" | "system"; content: string }[]
}

export type ChatResult = { text: string; error?: never } | { error: string; text?: never }

export type ChatApi = {
  generateChat(request: ChatRequest): Promise<ChatResult>
  cancelChat(id: string): Promise<void>
}
