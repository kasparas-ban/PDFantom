import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { AssistantRuntimeProvider, useAui, useLocalRuntime } from "@assistant-ui/react"

import type { ChatThreadSelection } from "../../../shared/chat-thread-api"
import { usePlatform } from "../app/platform"
import { createChatHistoryAdapter } from "./chat-history-adapter"
import { createChatModelAdapter } from "./chat-model-adapter"
import { supportsEffortChatModel } from "./chat-models"
import { useChatModelStore, useChatThreadStore, type ChatSession } from "./chat-session"
import type { ChatThreadTarget } from "./chat-thread-store"

type ChatSessionOwnerProps = {
  readonly target: ChatThreadTarget
  readonly onReady: (threadId: string, session: ChatSession) => void
  readonly onDispose: (threadId: string) => void
}

export function ChatSessionOwner({ target: initialTarget, onReady, onDispose }: ChatSessionOwnerProps) {
  const platform = usePlatform()
  const chatModelStore = useChatModelStore()
  const threadStore = useChatThreadStore()
  const [target] = useState(initialTarget)
  const { threadId } = target

  const { chatModel, history, interrupt } = useMemo(() => {
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

    const adapter = createChatModelAdapter(platform, getSelection, threadId)

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
        getSelection,
        onThreadChanged: (thread) => threadStore.getState().upsertThread(thread),
      }),
      interrupt: adapter.interrupt,
    }
  }, [chatModelStore, platform, target, threadId, threadStore])

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
}: Pick<ChatSessionOwnerProps, "onReady"> & Pick<ChatSession, "interruptRun"> & { threadId: string }) {
  const client = useAui()

  useLayoutEffect(() => {
    onReady(threadId, { client, interruptRun })
  }, [client, interruptRun, onReady, threadId])

  return null
}
