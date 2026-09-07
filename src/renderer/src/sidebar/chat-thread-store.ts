import { createStore } from "zustand/vanilla"

import {
  compareChatThreadsByActivity,
  type ChatThreadSummary,
} from "../../../shared/chat-thread-api"

export const VISIBLE_CHAT_THREADS_PER_DOCUMENT = 5

/**
 * What the chat panel is showing: a persisted Chat Thread, or a Draft that is not one
 * yet. A Draft with no Document is detached: its composer is disabled until a PDF opens.
 */
export type ChatThreadTarget = {
  readonly documentId: string | null
  readonly threadId: string
  readonly isDraft: boolean
}

export type ChatThreadState = {
  threads: readonly ChatThreadSummary[]
  isHydrated: boolean
  active: ChatThreadTarget | null
  streamingThreadIds: readonly string[]
  revealedDocumentIds: readonly string[]
  hydrate: (threads: readonly ChatThreadSummary[]) => void
  showDocument: (documentId: string) => void
  openThread: (thread: ChatThreadSummary) => void
  startDraft: (documentId: string) => void
  clearActive: () => void
  upsertThread: (thread: ChatThreadSummary) => void
  removeThread: (threadId: string) => void
  setStreaming: (threadId: string, streaming: boolean) => void
  toggleRevealed: (documentId: string) => void
}

export function createChatThreadStore(createId: () => string = () => crypto.randomUUID()) {
  return createStore<ChatThreadState>()((set, get) => ({
    threads: [],
    isHydrated: false,
    active: null,
    streamingThreadIds: [],
    revealedDocumentIds: [],
    hydrate: (threads) => set({ threads: sortThreads(threads), isHydrated: true }),
    showDocument: (documentId) => {
      const { active, threads, startDraft, openThread } = get()
      if (active?.documentId === documentId) return

      const recent = mostRecentlyViewed(threads, documentId)
      if (recent) {
        openThread(recent)
      } else {
        startDraft(documentId)
      }
    },
    openThread: (thread) =>
      set({ active: { documentId: thread.documentId, threadId: thread.id, isDraft: false } }),
    startDraft: (documentId) =>
      set({ active: { documentId, threadId: createId(), isDraft: true } }),
    clearActive: () =>
      set((state) =>
        state.active?.documentId === null
          ? state
          : { active: { documentId: null, threadId: createId(), isDraft: true } },
      ),
    upsertThread: (thread) =>
      set((state) => ({
        threads: sortThreads([
          ...state.threads.filter((existing) => existing.id !== thread.id),
          thread,
        ]),
        active:
          state.active?.threadId === thread.id && state.active.isDraft
            ? { ...state.active, isDraft: false }
            : state.active,
      })),
    removeThread: (threadId) =>
      set((state) => {
        const removed = state.threads.find((thread) => thread.id === threadId)

        return {
          threads: state.threads.filter((thread) => thread.id !== threadId),
          streamingThreadIds: state.streamingThreadIds.filter((id) => id !== threadId),
          active:
            state.active?.threadId === threadId && removed
              ? { documentId: removed.documentId, threadId: createId(), isDraft: true }
              : state.active,
        }
      }),
    setStreaming: (threadId, streaming) =>
      set((state) => {
        const isStreaming = state.streamingThreadIds.includes(threadId)
        if (isStreaming === streaming) return state

        return {
          streamingThreadIds: streaming
            ? [...state.streamingThreadIds, threadId]
            : state.streamingThreadIds.filter((id) => id !== threadId),
        }
      }),
    toggleRevealed: (documentId) =>
      set((state) => ({
        revealedDocumentIds: state.revealedDocumentIds.includes(documentId)
          ? state.revealedDocumentIds.filter((id) => id !== documentId)
          : [...state.revealedDocumentIds, documentId],
      })),
  }))
}

export type ChatThreadStore = ReturnType<typeof createChatThreadStore>

export function threadsOfDocument(threads: readonly ChatThreadSummary[], documentId: string) {
  return threads.filter((thread) => thread.documentId === documentId)
}

/** The rows a Document shows: the most recent few, always including the active one. */
export function visibleThreadsOfDocument(
  threads: readonly ChatThreadSummary[],
  documentId: string,
  activeThreadId: string | null,
  revealAll: boolean,
) {
  const all = threadsOfDocument(threads, documentId)
  if (revealAll || all.length <= VISIBLE_CHAT_THREADS_PER_DOCUMENT) {
    return { visible: all, hidden: 0 }
  }

  const visible = all.slice(0, VISIBLE_CHAT_THREADS_PER_DOCUMENT)
  const active = all.find((thread) => thread.id === activeThreadId)
  if (active && !visible.includes(active)) visible.push(active)

  return { visible, hidden: all.length - visible.length }
}

function mostRecentlyViewed(threads: readonly ChatThreadSummary[], documentId: string) {
  return threadsOfDocument(threads, documentId).reduce<ChatThreadSummary | null>(
    (best, thread) =>
      !best || thread.lastViewedAt.localeCompare(best.lastViewedAt) > 0 ? thread : best,
    null,
  )
}

function sortThreads(threads: readonly ChatThreadSummary[]) {
  return [...threads].toSorted(compareChatThreadsByActivity)
}
