import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react"
import type { AssistantClient } from "@assistant-ui/react"
import { useStore } from "zustand"

import { DEFAULT_CHAT_EFFORT } from "../../../shared/chat-api"
import type { ChatThreadSummary } from "../../../shared/chat-thread-api"
import { usePlatform } from "../app/platform"
import { useAppConfig } from "../store/app-config-provider"
import { useReaderSession } from "../store/reader-session-provider"
import { createChatModelStore, type ChatModelStore } from "./chat-model-store"
import { CHAT_MODEL_SOURCES } from "./chat-models"
import {
  createChatThreadStore,
  type ChatThreadState,
  type ChatThreadStore,
  type ChatThreadTarget,
} from "./chat-thread-store"

export type ChatSession = {
  readonly client: AssistantClient
  readonly interruptRun: () => void
}

const ChatSessionContext = createContext<ChatSession | null>(null)
const ChatModelStoreContext = createContext<ChatModelStore | null>(null)
const ChatThreadStoreContext = createContext<ChatThreadStore | null>(null)
const ChatSessionOwner = lazy(() =>
  import("./chat-session-owner").then((module) => ({ default: module.ChatSessionOwner })),
)

export function ChatSessionProvider({ children }: PropsWithChildren) {
  const isChatPanelOpen = useAppConfig((state) => state.isChatPanelOpen)
  const [isInitialized, setIsInitialized] = useState(isChatPanelOpen)
  const [sessions, setSessions] = useState<Readonly<Record<string, ChatSession>>>({})
  const platform = usePlatform()
  const [modelStore] = useState(() => createChatModelStore(platform))
  const [threadStore] = useState(() => createChatThreadStore())
  const selectedDocumentId = useReaderSession((state) => state.selectedDocument?.id ?? null)
  const isHydrated = useStore(threadStore, (state) => state.isHydrated)
  const active = useStore(threadStore, (state) => state.active)
  const threads = useStore(threadStore, (state) => state.threads)
  const streamingThreadIds = useStore(threadStore, (state) => state.streamingThreadIds)

  useEffect(() => {
    if (isChatPanelOpen) setIsInitialized(true)
  }, [isChatPanelOpen])

  useEffect(() => {
    const { loadSourceListings } = modelStore.getState()

    for (const { source } of CHAT_MODEL_SOURCES) void loadSourceListings(source)
  }, [modelStore])

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

  // The chat follows the selected Document: its most recently viewed Chat Thread, or a
  // Draft when it has none. Opening a thread row sets both, so this only fills gaps.
  useEffect(() => {
    if (!isHydrated) return

    if (selectedDocumentId) {
      threadStore.getState().showDocument(selectedDocumentId)
    } else {
      threadStore.getState().clearActive()
    }
  }, [isHydrated, selectedDocumentId, threadStore])

  const activeThreadId = active?.threadId ?? null
  const activeIsDraft = active?.isDraft ?? true

  useEffect(() => {
    if (!activeThreadId || activeIsDraft) return

    let disposed = false

    platform
      .markChatThreadViewed(activeThreadId)
      .then((thread) => {
        if (thread && !disposed) threadStore.getState().upsertThread(thread)
      })
      .catch(() => undefined)

    return () => {
      disposed = true
    }
  }, [activeIsDraft, activeThreadId, platform, threadStore])

  useEffect(() => {
    if (!activeThreadId) return

    const selection = threadStore
      .getState()
      .threads.find((thread) => thread.id === activeThreadId)?.selection

    modelStore
      .getState()
      .restoreSelection(
        selection ? { model: selection.model, effort: selection.effort ?? DEFAULT_CHAT_EFFORT } : null,
      )
  }, [activeThreadId, modelStore, threadStore])

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

  const background = streamingThreadIds
    .filter((id) => id !== active?.threadId)
    .map((threadId) => streamingTarget(threads, threadId))
  const ownedThreads = active ? [active, ...background] : background

  return (
    <ChatModelStoreContext value={modelStore}>
      <ChatThreadStoreContext value={threadStore}>
        {isInitialized && (
          <Suspense fallback={null}>
            {ownedThreads.map((target) => (
              <ChatSessionOwner
                documentId={target.documentId}
                isDraft={target.isDraft}
                key={target.threadId}
                onDispose={handleDispose}
                onReady={handleReady}
                threadId={target.threadId}
              />
            ))}
          </Suspense>
        )}
        <ChatSessionContext value={active ? (sessions[active.threadId] ?? null) : null}>
          {children}
        </ChatSessionContext>
      </ChatThreadStoreContext>
    </ChatModelStoreContext>
  )
}

/** A thread still streaming after the User moved on keeps its runtime alive. */
function streamingTarget(threads: readonly ChatThreadSummary[], threadId: string): ChatThreadTarget {
  const thread = threads.find((item) => item.id === threadId)

  return { threadId, documentId: thread?.documentId ?? "", isDraft: !thread }
}

export const useChatSession = () => useContext(ChatSessionContext)

export function useChatModelStore() {
  const store = useContext(ChatModelStoreContext)
  if (!store) throw new Error("useChatModelStore must be used within ChatSessionProvider")

  return store
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
