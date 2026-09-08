import type { ThreadMessage } from "@assistant-ui/react"

export const CHAT_MINIMAP_MINIMUM_TURNS = 2

export type ChatMinimapPreview = {
  readonly userText: string | null
  readonly assistantText: string | null
}

export function resolveChatMinimapTurnIds(messages: readonly ThreadMessage[]) {
  return messages.filter((message) => message.role === "user").map((message) => message.id)
}

export function resolveChatMinimapPreview(
  messages: readonly ThreadMessage[],
  turnId: string,
): ChatMinimapPreview | null {
  const turnIndex = messages.findIndex((message) => message.id === turnId)
  if (turnIndex === -1) return null

  let assistantText: string | null = null

  for (let index = turnIndex + 1; index < messages.length; index += 1) {
    const message = messages[index]
    if (message.role === "user") break
    if (message.role === "assistant") assistantText = resolveMessageText(message)
  }

  return {
    userText: compactPreview(resolveMessageText(messages[turnIndex])),
    assistantText: compactPreview(assistantText),
  }
}

function resolveMessageText(message: ThreadMessage) {
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
}

function compactPreview(text: string | null) {
  const compact = text?.replace(/\s+/gu, " ").trim() ?? ""

  return compact.length > 0 ? compact : null
}

export function resolveChatMinimapItemTopPercent(index: number, itemCount: number) {
  return (index / (itemCount - 1)) * 100
}

export function resolveChatMinimapIndexFromPointer(input: {
  readonly itemCount: number
  readonly pointerY: number
  readonly railHeight: number
  readonly railTop: number
}) {
  const progress = Math.max(0, Math.min(1, (input.pointerY - input.railTop) / input.railHeight))

  return Math.round(progress * (input.itemCount - 1))
}

export function resolveChatMinimapPreviewTranslate(index: number, itemCount: number) {
  if (index <= 0) return "0%"
  if (index >= itemCount - 1) return "-100%"

  return "-50%"
}
