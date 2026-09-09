import { formatUserMessageContent, type ChatThreadMessage } from "../shared/chat-thread-api"

export const SIDE_CHAT_INSTRUCTION =
  "The following is the main conversation. The User is asking about it in a side conversation. Answer the side conversation and do not continue the main one."

export function formatParentMessages(messages: readonly ChatThreadMessage[]) {
  return messages
    .map((message) =>
      message.role === "user"
        ? `User:\n${formatUserMessageContent(message.content, message.quotes ?? [])}`
        : `Assistant:\n${message.content}`,
    )
    .join("\n\n")
}

export function parentContextBlock(messages: readonly ChatThreadMessage[]) {
  return `${SIDE_CHAT_INSTRUCTION}\n\n${formatParentMessages(messages)}`
}
