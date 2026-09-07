import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react"
import type { AssistantClient } from "@assistant-ui/react"
import { useStore } from "zustand"

import { usePlatform } from "../app/platform"
import { useAppConfig } from "../store/app-config-provider"
import { createChatModelStore, type ChatModelStore } from "./chat-model-store"
import { CHAT_MODEL_SOURCES } from "./chat-models"

const ChatClientContext = createContext<AssistantClient | null>(null)
const ChatModelStoreContext = createContext<ChatModelStore | null>(null)
const ChatSessionOwner = lazy(() =>
  import("./chat-session-owner").then((module) => ({ default: module.ChatSessionOwner })),
)

export function ChatSessionProvider({ children }: PropsWithChildren) {
  const isChatPanelOpen = useAppConfig((state) => state.isChatPanelOpen)
  const [isInitialized, setIsInitialized] = useState(isChatPanelOpen)
  const [client, setClient] = useState<AssistantClient | null>(null)
  const platform = usePlatform()
  const [modelStore] = useState(() => createChatModelStore(platform))

  useEffect(() => {
    if (isChatPanelOpen) setIsInitialized(true)
  }, [isChatPanelOpen])

  useEffect(() => {
    const { loadSourceListings } = modelStore.getState()

    for (const { source } of CHAT_MODEL_SOURCES) void loadSourceListings(source)
  }, [modelStore])

  return (
    <ChatModelStoreContext value={modelStore}>
      {isInitialized && (
        <Suspense fallback={null}>
          <ChatSessionOwner onReady={setClient} />
        </Suspense>
      )}
      <ChatClientContext value={client}>{children}</ChatClientContext>
    </ChatModelStoreContext>
  )
}

export const useChatSession = () => useContext(ChatClientContext)

export function useChatModelStore() {
  const store = useContext(ChatModelStoreContext)
  if (!store) throw new Error("useChatModelStore must be used within ChatSessionProvider")

  return store
}

export function useChatModel() {
  const store = useChatModelStore()
  const state = useStore(store)
  const selectedModel = state.models.find((model) => model.id === state.model)
  if (!selectedModel) throw new Error("The selected chat model must belong to the catalog")

  return { ...state, selectedModel }
}
