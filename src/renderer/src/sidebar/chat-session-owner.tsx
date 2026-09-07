import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import {
  AssistantRuntimeProvider,
  useAui,
  useLocalRuntime,
  type ChatModelRunOptions,
} from "@assistant-ui/react"

import type { ChatThreadSelection } from "../../../shared/chat-thread-api"
import { usePlatform } from "../app/platform"
import { createChatHistoryAdapter } from "./chat-history-adapter"
import { createChatModelAdapter } from "./chat-model-adapter"
import { supportsEffortChatModel } from "./chat-models"
import { useChatModelStore, useChatThreadStore, type ChatSession } from "./chat-session"

type ChatSessionOwnerProps = {
  readonly threadId: string
  readonly documentId: string | null
  readonly isDraft: boolean
  readonly onReady: (threadId: string, session: ChatSession) => void
  readonly onDispose: (threadId: string) => void
}

/**
 * One assistant-ui runtime for one Chat Thread. Mounted while the thread is visible or
 * still streaming; unmounting aborts nothing that has already been persisted.
 */
export function ChatSessionOwner({
  threadId,
  documentId,
  isDraft,
  onReady,
  onDispose,
}: ChatSessionOwnerProps) {
  const platform = usePlatform()
  const chatModelStore = useChatModelStore()
  const threadStore = useChatThreadStore()
  // A Draft turns into a Chat Thread on its first send; the adapter tracks that itself.
  const [startedAsDraft] = useState(isDraft)

  const adapter = useMemo(() => {
    // The visible thread follows the picker. A thread streaming in the background keeps
    // the Model it last sent with, so switching threads never changes a queued run.
    const getSelection = (): ChatThreadSelection => {
      const { active, threads } = threadStore.getState()
      const remembered = threads.find((thread) => thread.id === threadId)?.selection
      if (active?.threadId !== threadId && remembered) return remembered

      const { model, effort, models } = chatModelStore.getState()
      const selectedModel = models.find((option) => option.id === model)
      if (!selectedModel) throw new Error("The selected chat model must belong to the catalog")

      return {
        model,
        source: selectedModel.source,
        ...(supportsEffortChatModel(selectedModel) && { effort }),
      }
    }

    const chatModel = createChatModelAdapter(platform, getSelection, threadId)
    const history = createChatHistoryAdapter({
      platform,
      threadId,
      documentId,
      isDraft: startedAsDraft,
      getSelection,
      onThreadChanged: (thread) => threadStore.getState().upsertThread(thread),
    })

    return {
      history,
      interrupt: chatModel.interrupt,
      async *run(options: ChatModelRunOptions) {
        threadStore.getState().setStreaming(threadId, true)

        try {
          yield* chatModel.run(options)
        } finally {
          threadStore.getState().setStreaming(threadId, false)
        }
      },
    }
  }, [chatModelStore, documentId, platform, startedAsDraft, threadId, threadStore])

  const runtime = useLocalRuntime(adapter, {
    adapters: { history: adapter.history },
    unstable_enableMessageQueue: true,
  })

  useEffect(() => () => onDispose(threadId), [onDispose, threadId])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatSessionReady interruptRun={adapter.interrupt} onReady={onReady} threadId={threadId} />
    </AssistantRuntimeProvider>
  )
}

function ChatSessionReady({
  interruptRun,
  onReady,
  threadId,
}: Pick<ChatSessionOwnerProps, "onReady" | "threadId"> & Pick<ChatSession, "interruptRun">) {
  const client = useAui()

  useLayoutEffect(() => {
    onReady(threadId, { client, interruptRun })
  }, [client, interruptRun, onReady, threadId])

  return null
}
