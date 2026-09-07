import { useLayoutEffect, useMemo, useState } from "react"
import { AssistantRuntimeProvider, useAui, useLocalRuntime } from "@assistant-ui/react"

import { usePlatform } from "../app/platform"
import { createChatModelAdapter } from "./chat-model-adapter"
import { supportsEffortChatModel } from "./chat-models"
import { useChatModelStore, type ChatSession } from "./chat-session"

type ChatSessionOwnerProps = {
  readonly onReady: (session: ChatSession) => void
}

export function ChatSessionOwner({ onReady }: ChatSessionOwnerProps) {
  const platform = usePlatform()
  const chatModelStore = useChatModelStore()
  const [conversationId] = useState(() => crypto.randomUUID())
  const adapter = useMemo(
    () =>
      createChatModelAdapter(
        platform,
        () => {
          const { model, effort, models } = chatModelStore.getState()
          const selectedModel = models.find((option) => option.id === model)
          if (!selectedModel) throw new Error("The selected chat model must belong to the catalog")

          return {
            model,
            source: selectedModel.source,
            ...(supportsEffortChatModel(selectedModel) && { effort }),
          }
        },
        conversationId,
      ),
    [chatModelStore, conversationId, platform],
  )
  const runtime = useLocalRuntime(adapter, { unstable_enableMessageQueue: true })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatSessionReady interruptRun={adapter.interrupt} onReady={onReady} />
    </AssistantRuntimeProvider>
  )
}

function ChatSessionReady({
  interruptRun,
  onReady,
}: ChatSessionOwnerProps & Pick<ChatSession, "interruptRun">) {
  const client = useAui()

  useLayoutEffect(() => {
    onReady({ client, interruptRun })
  }, [client, interruptRun, onReady])

  return null
}
