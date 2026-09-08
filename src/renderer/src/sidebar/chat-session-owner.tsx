import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { AssistantRuntimeProvider, useAui, useLocalRuntime } from "@assistant-ui/react"

import type { ChatThreadSelection } from "../../../shared/chat-thread-api"
import { usePlatform } from "../app/platform"
import { createChatHistoryAdapter } from "./chat-history-adapter"
import { createChatModelAdapter } from "./chat-model-adapter"
import { currentSelection, type ChatModelStore } from "./chat-model-store"
import { useChatThreadStore, type ChatSession } from "./chat-session"
import type { ChatThreadTarget } from "./chat-thread-store"

type ChatSessionOwnerProps = {
  readonly target: ChatThreadTarget
  readonly modelStore: ChatModelStore
  readonly onReady: (threadId: string, session: ChatSession) => void
  readonly onDispose: (threadId: string) => void
}

export function ChatSessionOwner({
  target: initialTarget,
  modelStore,
  onReady,
  onDispose,
}: ChatSessionOwnerProps) {
  const platform = usePlatform()
  const threadStore = useChatThreadStore()
  const [target] = useState(initialTarget)
  const { threadId, parentThreadId } = target

  const { chatModel, history, interrupt } = useMemo(() => {
    const getSelection = (): ChatThreadSelection => {
      const { active, activeSideChat, threads } = threadStore.getState()
      const shown = parentThreadId === null ? active : activeSideChat
      const remembered = threads.find((thread) => thread.id === threadId)?.selection
      if (shown?.threadId !== threadId && remembered) return remembered

      return currentSelection(modelStore.getState())
    }

    const adapter = createChatModelAdapter(platform, getSelection, threadId, parentThreadId)

    return {
      chatModel: {
        async *run(options: Parameters<typeof adapter.run>[0]) {
          threadStore.getState().setStreaming(target, true)

          try {
            yield* adapter.run(options)
          } finally {
            threadStore.getState().setStreaming(target, false)
          }
        },
      },
      history: createChatHistoryAdapter({
        platform,
        threadId,
        documentId: target.documentId,
        isDraft: target.isDraft,
        parentThreadId,
        getSelection,
        onThreadChanged: (thread) => threadStore.getState().upsertThread(thread),
      }),
      interrupt: adapter.interrupt,
    }
  }, [modelStore, parentThreadId, platform, target, threadId, threadStore])

  const runtime = useLocalRuntime(chatModel, {
    adapters: { history },
    unstable_enableMessageQueue: true,
  })

  useEffect(() => () => onDispose(threadId), [onDispose, threadId])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatSessionReady interruptRun={interrupt} onReady={onReady} threadId={threadId} />
    </AssistantRuntimeProvider>
  )
}

function ChatSessionReady({
  interruptRun,
  onReady,
  threadId,
}: Pick<ChatSessionOwnerProps, "onReady"> &
  Pick<ChatSession, "interruptRun"> & { threadId: string }) {
  const client = useAui()

  useLayoutEffect(() => {
    onReady(threadId, { client, interruptRun })
  }, [client, interruptRun, onReady, threadId])

  return null
}
