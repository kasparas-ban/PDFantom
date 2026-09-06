import { useLayoutEffect, useMemo } from "react"
import {
  AssistantRuntimeProvider,
  useAui,
  useLocalRuntime,
  type AssistantClient,
} from "@assistant-ui/react"

import { usePlatform } from "../app/platform"
import { createChatModelAdapter } from "./chat-model-adapter"
import { useChatModelStore } from "./chat-session"

type ChatSessionOwnerProps = {
  readonly onReady: (client: AssistantClient) => void
}

export function ChatSessionOwner({ onReady }: ChatSessionOwnerProps) {
  const platform = usePlatform()
  const chatModelStore = useChatModelStore()
  const adapter = useMemo(
    () =>
      createChatModelAdapter(platform, () => {
        const { model, effort, models } = chatModelStore.getState()
        const selectedModel = models.find((option) => option.id === model)
        if (!selectedModel) throw new Error("The selected chat model must belong to the catalog")

        return {
          model,
          effort,
          source: selectedModel.source,
          supportsEffort: selectedModel.supportsEffort === true,
        }
      }),
    [chatModelStore, platform],
  )
  const runtime = useLocalRuntime(adapter)

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
