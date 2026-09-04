import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"
import type { AssistantRuntime } from "@assistant-ui/react"

import { useAppConfig } from "../store/app-config-provider"

const ChatRuntimeContext = createContext<AssistantRuntime | null>(null)
const ChatModelContext = createContext<{
  readonly model: string
  readonly setModel: (model: string) => void
} | null>(null)
const ChatSessionOwner = lazy(() =>
  import("./chat-session-owner").then((module) => ({ default: module.ChatSessionOwner })),
)

export function ChatSessionProvider({ children }: PropsWithChildren) {
  const isChatPanelOpen = useAppConfig((state) => state.isChatPanelOpen)
  const [isInitialized, setIsInitialized] = useState(isChatPanelOpen)
  const [runtime, setRuntime] = useState<AssistantRuntime | null>(null)
  const [model, setModel] = useState("gpt-5.4-nano")

  useEffect(() => {
    if (isChatPanelOpen) setIsInitialized(true)
  }, [isChatPanelOpen])

  const modelContext = useMemo(() => ({ model, setModel }), [model])

  return (
    <ChatModelContext value={modelContext}>
      {isInitialized && (
        <Suspense fallback={null}>
          <ChatSessionOwner onReady={setRuntime} model={model} />
        </Suspense>
      )}
      <ChatRuntimeContext value={runtime}>{children}</ChatRuntimeContext>
    </ChatModelContext>
  )
}

export const useChatSession = () => useContext(ChatRuntimeContext)

export function useChatModel() {
  const context = useContext(ChatModelContext)
  if (!context) throw new Error("useChatModel must be used within ChatSessionProvider")

  return context
}
