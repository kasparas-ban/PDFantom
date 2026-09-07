import { z } from "zod"

import { GENERIC_CHAT_ERROR, type ChatMessage } from "../../shared/chat-api"

export type CodexThreadState = {
  threadId: string
  lastUserMessageId: string
  messageCount: number
}

export type CodexTurnPlan =
  | { kind: "continue"; threadId: string; input: string }
  | { kind: "rebuild"; input: string }

export function planCodexTurn(
  state: CodexThreadState | undefined,
  messages: readonly ChatMessage[],
): CodexTurnPlan {
  const newest = messages.at(-1)
  if (!newest || newest.role !== "user") throw new Error(GENERIC_CHAT_ERROR)

  if (state && extendsThread(state, messages)) {
    return { kind: "continue", threadId: state.threadId, input: newest.content }
  }

  return { kind: "rebuild", input: flattenTranscript(messages) }
}

function extendsThread(state: CodexThreadState, messages: readonly ChatMessage[]) {
  const seenUser = messages[state.messageCount - 1]
  const reply = messages[state.messageCount]

  return (
    messages.length === state.messageCount + 2 &&
    seenUser?.id === state.lastUserMessageId &&
    reply?.role === "assistant"
  )
}

const TRANSCRIPT_ROLE_LABELS: Record<ChatMessage["role"], string> = {
  user: "User",
  assistant: "Assistant",
  system: "Instructions",
}

export function flattenTranscript(messages: readonly ChatMessage[]) {
  const newest = messages.at(-1)
  if (!newest) throw new Error(GENERIC_CHAT_ERROR)

  const history = messages.slice(0, -1)
  if (history.length === 0) return newest.content

  const transcript = history
    .map((message) => `${TRANSCRIPT_ROLE_LABELS[message.role]}:\n${message.content}`)
    .join("\n\n")

  return `The conversation so far, oldest first:\n\n${transcript}\n\nThe User's new message:\n${newest.content}`
}

const codexTurnErrorSchema = z.object({
  message: z.string(),
})

const upstreamErrorSchema = z.object({
  error: z.object({ message: z.string().trim().min(1) }),
})

export function codexTurnErrorMessage(error: unknown) {
  const turnError = codexTurnErrorSchema.safeParse(error)
  if (!turnError.success) return GENERIC_CHAT_ERROR

  const message = turnError.data.message.trim()
  if (!message) return GENERIC_CHAT_ERROR

  const upstream = upstreamErrorSchema.safeParse(parseJson(message))

  return (upstream.success ? upstream.data.error.message : message).slice(0, 2_000)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
