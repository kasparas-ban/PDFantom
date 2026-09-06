import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react"
import type { AssistantRuntime } from "@assistant-ui/react"
import { useStore } from "zustand"

import { useAppConfig } from "../store/app-config-provider"
import { createChatModelStore, type ChatModelStore } from "./chat-model-store"

const ChatRuntimeContext = createContext<AssistantRuntime | null>(null)
const ChatModelStoreContext = createContext<ChatModelStore | null>(null)
const ChatSessionOwner = lazy(() =>
  import("./chat-session-owner").then((module) => ({ default: module.ChatSessionOwner })),
)

export function ChatSessionProvider({ children }: PropsWithChildren) {
  const isChatPanelOpen = useAppConfig((state) => state.isChatPanelOpen)
  const [isInitialized, setIsInitialized] = useState(isChatPanelOpen)
  const [runtime, setRuntime] = useState<AssistantRuntime | null>(null)
  const [modelStore] = useState(() => createChatModelStore())

  useEffect(() => {
    if (isChatPanelOpen) setIsInitialized(true)
  }, [isChatPanelOpen])

  return (
    <ChatModelStoreContext value={modelStore}>
      {isInitialized && (
        <Suspense fallback={null}>
          <ChatSessionOwner onReady={setRuntime} />
        </Suspense>
      )}
      <ChatRuntimeContext value={runtime}>{children}</ChatRuntimeContext>
    </ChatModelStoreContext>
  )
}

export const useChatSession = () => useContext(ChatRuntimeContext)

export function useChatModelStore() {
  const store = useContext(ChatModelStoreContext)
  if (!store) throw new Error("useChatModelStore must be used within ChatSessionProvider")

  return store
}

export function useChatModel() {
  const store = useChatModelStore()
  return useStore(store)
}
