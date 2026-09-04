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
const ChatModelContext = createContext({ model: "gpt-5.4-nano", setModel: (_model: string) => {} })
const Owner = lazy(() =>
  import("./chat-panel").then((module) => ({ default: module.ChatSessionOwner })),
)

export function ChatSessionProvider({ children }: PropsWithChildren) {
  const open = useAppConfig((state) => state.isChatPanelOpen)
  const [initialized, setInitialized] = useState(open)
  const [runtime, setRuntime] = useState<AssistantRuntime | null>(null)
  const [model, setModel] = useState("gpt-5.4-nano")
  useEffect(() => {
    if (open) setInitialized(true)
  }, [open])

  const modelContext = useMemo(() => ({ model, setModel }), [model])

  return (
    <ChatModelContext value={modelContext}>
      {initialized && (
        <Suspense fallback={null}>
          <Owner onReady={setRuntime} model={model} />
        </Suspense>
      )}
      <ChatRuntimeContext value={runtime}>{children}</ChatRuntimeContext>
    </ChatModelContext>
  )
}

export const useChatSession = () => useContext(ChatRuntimeContext)
export const useChatModel = () => useContext(ChatModelContext)
