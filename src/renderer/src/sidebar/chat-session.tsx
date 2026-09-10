import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"
import type { AssistantClient } from "@assistant-ui/react"
import { useStore } from "zustand"

import { usePlatform } from "../app/platform"
import { useAppConfig } from "../store/app-config-provider"
import { useReaderSession } from "../store/reader-session-provider"
import {
  createChatModelStore,
  createSideChatModelStore,
  currentSelection,
  type ChatModelStore,
} from "./chat-model-store"
import { CHAT_MODEL_SOURCES } from "./chat-models"
import {
  createChatThreadStore,
  type ChatThreadState,
  type ChatThreadStore,
  type ChatThreadTarget,
  type ChatPanelMode,
} from "./chat-thread-store"

export type ChatSession = {
  readonly client: AssistantClient
  readonly interruptRun: () => void
}

export type { ChatPanelMode }

type PerMode<T> = Readonly<Record<ChatPanelMode, T>>

const ChatSessionsContext = createContext<PerMode<ChatSession | null>>({ main: null, side: null })
const ChatModelStoresContext = createContext<PerMode<ChatModelStore> | null>(null)
const ChatThreadStoreContext = createContext<ChatThreadStore | null>(null)
export const ChatPanelModeContext = createContext<ChatPanelMode>("main")
const ChatSessionOwner = lazy(() =>
  import("./chat-session-owner").then((module) => ({ default: module.ChatSessionOwner })),
)

export function ChatSessionProvider({ children }: PropsWithChildren) {
  const isChatPanelOpen = useAppConfig((state) => state.isChatPanelOpen)
  const [isInitialized, setIsInitialized] = useState(isChatPanelOpen)
  const [sessions, setSessions] = useState<Readonly<Record<string, ChatSession>>>({})
  const platform = usePlatform()
  const [modelStores] = useState<PerMode<ChatModelStore>>(() => {
    const main = createChatModelStore(platform)

    return { main, side: createSideChatModelStore(platform, main) }
  })
  const [threadStore] = useState(() => createChatThreadStore())
  const selectedDocumentId = useReaderSession((state) => state.selectedDocument?.id ?? null)
  const isHydrated = useStore(threadStore, (state) => state.isHydrated)
  const active = useStore(threadStore, (state) => state.active)
  const activeSideChat = useStore(threadStore, (state) => state.activeSideChat)
  const sideChatDrafts = useStore(threadStore, (state) => state.sideChatDrafts)
  const streaming = useStore(threadStore, (state) => state.streaming)

  useEffect(() => {
    if (isChatPanelOpen) setIsInitialized(true)
  }, [isChatPanelOpen])

  useEffect(() => {
    const { loadSourceListings } = modelStores.main.getState()

    for (const { source } of CHAT_MODEL_SOURCES) void loadSourceListings(source)
  }, [modelStores])

  useEffect(() => {
    let disposed = false

    platform
      .listChatThreads()
      .then((stored) => {
        if (!disposed) threadStore.getState().hydrate(stored)
      })
      .catch(() => {
        if (!disposed) threadStore.getState().hydrate([])
      })

    return () => {
      disposed = true
    }
  }, [platform, threadStore])

  useEffect(() => {
    if (!isHydrated) return

    if (selectedDocumentId) {
      threadStore.getState().showDocument(selectedDocumentId)
    } else {
      threadStore.getState().detach()
    }
  }, [isHydrated, selectedDocumentId, threadStore])

  useMarkViewed(active, threadStore)
  useMarkViewed(activeSideChat, threadStore)

  const activeThreadId = active?.threadId ?? null
  const sideChatId = activeSideChat?.threadId ?? null
  const sideChatIsDraft = activeSideChat?.isDraft ?? true

  useEffect(() => {
    if (!activeThreadId) return

    modelStores.main.getState().restoreSelection(rememberedSelection(threadStore, activeThreadId))
  }, [activeThreadId, modelStores, threadStore])

  useEffect(() => {
    if (!sideChatId) return

    const remembered = sideChatIsDraft ? null : rememberedSelection(threadStore, sideChatId)
    modelStores.side
      .getState()
      .restoreSelection(remembered ?? currentSelection(modelStores.main.getState()))
  }, [modelStores, sideChatId, sideChatIsDraft, threadStore])

  const handleReady = useCallback((threadId: string, session: ChatSession) => {
    setSessions((current) =>
      current[threadId] === session ? current : { ...current, [threadId]: session },
    )
  }, [])

  const handleDispose = useCallback((threadId: string) => {
    setSessions((current) => {
      if (!(threadId in current)) return current

      const { [threadId]: _removed, ...rest } = current

      return rest
    })
  }, [])

  const shown = [active, activeSideChat].filter((target) => target !== null)
  const ownedThreads = [
    ...shown,
    ...sideChatDrafts.filter(
      (target) => !shown.some((owned) => owned.threadId === target.threadId),
    ),
    ...streaming.filter(
      (target) =>
        ![...shown, ...sideChatDrafts].some((owned) => owned.threadId === target.threadId),
    ),
  ]
  const currentSessions = useMemo(
    () => ({
      main: activeThreadId ? (sessions[activeThreadId] ?? null) : null,
      side: sideChatId ? (sessions[sideChatId] ?? null) : null,
    }),
    [activeThreadId, sessions, sideChatId],
  )

  return (
    <ChatModelStoresContext value={modelStores}>
      <ChatThreadStoreContext value={threadStore}>
        {isInitialized && (
          <Suspense fallback={null}>
            {ownedThreads.map((target) => (
              <ChatSessionOwner
                key={target.threadId}
                modelStore={target.parentThreadId ? modelStores.side : modelStores.main}
                onDispose={handleDispose}
                onReady={handleReady}
                target={target}
              />
            ))}
          </Suspense>
        )}
        <ChatSessionsContext value={currentSessions}>{children}</ChatSessionsContext>
      </ChatThreadStoreContext>
    </ChatModelStoresContext>
  )
}

function useMarkViewed(target: ChatThreadTarget | null, threadStore: ChatThreadStore) {
  const platform = usePlatform()
  const threadId = target?.threadId ?? null
  const isDraft = target?.isDraft ?? true

  useEffect(() => {
    if (!threadId || isDraft) return

    let disposed = false

    platform
      .markChatThreadViewed(threadId)
      .then((thread) => {
        if (thread && !disposed) threadStore.getState().upsertThread(thread)
      })
      .catch(() => undefined)

    return () => {
      disposed = true
    }
  }, [isDraft, platform, threadId, threadStore])
}

function rememberedSelection(threadStore: ChatThreadStore, threadId: string) {
  return threadStore.getState().threads.find((thread) => thread.id === threadId)?.selection ?? null
}

export const useChatPanelMode = () => useContext(ChatPanelModeContext)

export function useChatSession() {
  return useContext(ChatSessionsContext)[useChatPanelMode()]
}

export function useChatModelStore() {
  const stores = useContext(ChatModelStoresContext)
  if (!stores) throw new Error("useChatModelStore must be used within ChatSessionProvider")

  return stores[useChatPanelMode()]
}

export function useChatThreadStore() {
  const store = useContext(ChatThreadStoreContext)
  if (!store) throw new Error("useChatThreadStore must be used within ChatSessionProvider")

  return store
}

export function useChatThreads<T>(selector: (state: ChatThreadState) => T) {
  return useStore(useChatThreadStore(), selector)
}

export function useChatModel() {
  const store = useChatModelStore()
  const state = useStore(store)
  const selectedModel = state.models.find((model) => model.id === state.model)
  if (!selectedModel) throw new Error("The selected chat model must belong to the catalog")

  return { ...state, selectedModel }
}
