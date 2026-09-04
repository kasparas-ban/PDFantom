import { useEffect, useLayoutEffect } from "react"
import type { AssistantRuntime } from "@assistant-ui/react"
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk"

type ChatSessionOwnerProps = {
  readonly model: string
  readonly onReady: (runtime: AssistantRuntime) => void
}

export function ChatSessionOwner({ onReady, model }: ChatSessionOwnerProps) {
  const runtime = useChatRuntime({ transport: new AssistantChatTransport({ api: "/api/chat" }) })

  useLayoutEffect(() => {
    onReady(runtime)
  }, [runtime, onReady])

  useEffect(
    () =>
      runtime.registerModelContextProvider({
        getModelContext: () => ({ config: { modelName: model } }),
      }),
    [runtime, model],
  )

  return null
}
