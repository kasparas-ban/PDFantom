import { useEffect, useLayoutEffect } from "react"
import type { AssistantRuntime } from "@assistant-ui/react"
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk"

export function ChatSessionOwner({
  onReady,
  model,
}: {
  onReady: (runtime: AssistantRuntime) => void
  model: string
}) {
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
