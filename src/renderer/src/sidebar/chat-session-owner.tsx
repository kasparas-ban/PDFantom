import { useLayoutEffect } from "react"
import { useLocalRuntime, type AssistantRuntime } from "@assistant-ui/react"

import { usePlatform } from "../app/platform"
import { useChatModelStore } from "./chat-session"

type ChatSessionOwnerProps = {
  readonly onReady: (runtime: AssistantRuntime) => void
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
        const result = await platform.generateChat({
          id,
          model: chatModelStore.getState().model,
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

  useLayoutEffect(() => {
    onReady(runtime)
  }, [runtime, onReady])

  return null
}
