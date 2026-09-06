import { useLayoutEffect } from "react"
import {
  AssistantRuntimeProvider,
  useAui,
  useLocalRuntime,
  type AssistantClient,
} from "@assistant-ui/react"

import { usePlatform } from "../app/platform"
import { supportsEffortChatModel } from "./chat-models"
import { useChatModelStore } from "./chat-session"

type ChatSessionOwnerProps = {
  readonly onReady: (client: AssistantClient) => void
}

export function ChatSessionOwner({ onReady }: ChatSessionOwnerProps) {
  const platform = usePlatform()
  const chatModelStore = useChatModelStore()

  const runtime = useLocalRuntime({
    async run({ messages, abortSignal }) {
      const id = crypto.randomUUID()
      const cancel = () => {
        void platform.cancelChat(id).catch(() => undefined)
      }
      abortSignal.throwIfAborted()
      abortSignal.addEventListener("abort", cancel, { once: true })

      try {
        const { model, effort, models } = chatModelStore.getState()
        const supportsEffort = models.some(
          (option) => option.id === model && supportsEffortChatModel(option),
        )
        const result = await platform.generateChat({
          id,
          model,
          ...(supportsEffort && { effort }),
          messages: messages
            .map((message) => ({
              role: message.role,
              content: message.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n"),
            }))
            .filter((message) => message.content.length > 0),
        })
        abortSignal.throwIfAborted()
        if (!result.text) throw new Error(result.error)

        return { content: [{ type: "text", text: result.text }] }
      } finally {
        abortSignal.removeEventListener("abort", cancel)
      }
    },
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatSessionReady onReady={onReady} />
    </AssistantRuntimeProvider>
  )
}

function ChatSessionReady({ onReady }: ChatSessionOwnerProps) {
  const client = useAui()

  useLayoutEffect(() => {
    onReady(client)
  }, [client, onReady])

  return null
}
