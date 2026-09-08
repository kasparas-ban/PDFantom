import { createStore } from "zustand/vanilla"

import {
  compareChatThreadsByActivity,
  type ChatThreadQuote,
  type ChatThreadSummary,
} from "../../../shared/chat-thread-api"

export const VISIBLE_CHAT_THREADS_PER_DOCUMENT = 5

export type ChatThreadTarget = {
  readonly documentId: string | null
  readonly threadId: string
  readonly isDraft: boolean
  readonly parentThreadId: string | null
}

export type ChatThreadState = {
  threads: readonly ChatThreadSummary[]
  isHydrated: boolean
  active: ChatThreadTarget | null
  activeSideChat: ChatThreadTarget | null
  pendingSideChatQuote: ChatThreadQuote | null
  streaming: readonly ChatThreadTarget[]
  revealedDocumentIds: readonly string[]
  hydrate: (threads: readonly ChatThreadSummary[]) => void
  showDocument: (documentId: string) => void
  openThread: (thread: ChatThreadSummary) => void
  startDraft: (documentId: string) => void
  detach: () => void
  openSideChat: (thread: ChatThreadSummary) => void
  startSideChatDraft: () => void
  removeSideChat: (threadId: string) => void
  askInSideChat: (quote: ChatThreadQuote) => void
  takeSideChatQuote: () => void
  upsertThread: (thread: ChatThreadSummary) => void
  removeThread: (threadId: string) => void
  setStreaming: (target: ChatThreadTarget, streaming: boolean) => void
  toggleRevealed: (documentId: string) => void
}

export function createChatThreadStore(createId: () => string = () => crypto.randomUUID()) {
  const draftTarget = (documentId: string | null): ChatThreadTarget => ({
    documentId,
    threadId: createId(),
    isDraft: true,
    parentThreadId: null,
  })

  const sideChatDraft = (parent: ChatThreadTarget): ChatThreadTarget => ({
    documentId: parent.documentId,
    threadId: createId(),
    isDraft: true,
    parentThreadId: parent.threadId,
  })

  const sideChatFor = (
    threads: readonly ChatThreadSummary[],
    parent: ChatThreadTarget | null,
  ): ChatThreadTarget | null => {
    if (!parent || parent.isDraft) return null

    const recent = mostRecentlyViewed(sideChatsOf(threads, parent.threadId))

    return recent ? targetOf(recent) : sideChatDraft(parent)
  }

  return createStore<ChatThreadState>()((set, get) => {
    const activate = (active: ChatThreadTarget | null) =>
      set((state) => ({ active, activeSideChat: sideChatFor(state.threads, active) }))

    return {
      threads: [],
      isHydrated: false,
      active: null,
      activeSideChat: null,
      pendingSideChatQuote: null,
      streaming: [],
      revealedDocumentIds: [],
      hydrate: (threads) => set({ threads: sortThreads(threads), isHydrated: true }),
      showDocument: (documentId) => {
        const { active, threads, startDraft, openThread } = get()
        if (active?.documentId === documentId) return

        const recent = mostRecentlyViewed(threadsOfDocument(threads, documentId))
        if (recent) {
          openThread(recent)
        } else {
          startDraft(documentId)
        }
      },
      openThread: (thread) => activate(targetOf(thread)),
      startDraft: (documentId) => activate(draftTarget(documentId)),
      detach: () => {
        if (get().active?.documentId !== null) activate(draftTarget(null))
      },
      openSideChat: (thread) => set({ activeSideChat: targetOf(thread) }),
      startSideChatDraft: () =>
        set((state) => ({
          activeSideChat: state.active ? sideChatDraft(state.active) : state.activeSideChat,
        })),
      removeSideChat: (threadId) =>
        set((state) => {
          const { active, activeSideChat } = state
          const threads = state.threads.filter((thread) => thread.id !== threadId)
          if (activeSideChat?.threadId !== threadId) {
            return { threads, streaming: withoutThread(state.streaming, threadId) }
          }

          const siblings = active ? sideChatsOf(state.threads, active.threadId) : []
          const found = siblings.findIndex((thread) => thread.id === threadId)
          const index = found === -1 ? siblings.length : found
          const next = siblings[index + 1] ?? siblings[index - 1]

          return {
            threads,
            streaming: withoutThread(state.streaming, threadId),
            activeSideChat: next ? targetOf(next) : sideChatFor(threads, active),
          }
        }),
      askInSideChat: (quote) =>
        set((state) => ({
          pendingSideChatQuote: quote,
          activeSideChat: state.activeSideChat ?? sideChatFor(state.threads, state.active),
        })),
      takeSideChatQuote: () => set({ pendingSideChatQuote: null }),
      upsertThread: (thread) =>
        set((state) => {
          const threads = sortThreads([
            ...state.threads.filter((existing) => existing.id !== thread.id),
            thread,
          ])
          const { active, activeSideChat } = state
          if (active?.threadId === thread.id && active.isDraft) {
            const settled = { ...active, isDraft: false }

            return { threads, active: settled, activeSideChat: sideChatFor(threads, settled) }
          }

          if (activeSideChat?.threadId === thread.id && activeSideChat.isDraft) {
            return { threads, activeSideChat: { ...activeSideChat, isDraft: false } }
          }

          return { threads }
        }),
      removeThread: (threadId) =>
        set((state) => {
          const removed = state.threads.find((thread) => thread.id === threadId)
          const remaining = state.threads.filter(
            (thread) => thread.id !== threadId && thread.parentThreadId !== threadId,
          )
          const active =
            state.active?.threadId === threadId && removed
              ? draftTarget(removed.documentId)
              : state.active

          return {
            threads: remaining,
            streaming: state.streaming.filter(
              (target) => target.threadId !== threadId && target.parentThreadId !== threadId,
            ),
            active,
            activeSideChat: active === state.active ? state.activeSideChat : null,
          }
        }),
      setStreaming: (target, streaming) =>
        set((state) => {
          if (isStreaming(state, target.threadId) === streaming) return state

          return {
            streaming: streaming
              ? [...state.streaming, target]
              : withoutThread(state.streaming, target.threadId),
          }
        }),
      toggleRevealed: (documentId) =>
        set((state) => ({
          revealedDocumentIds: state.revealedDocumentIds.includes(documentId)
            ? state.revealedDocumentIds.filter((id) => id !== documentId)
            : [...state.revealedDocumentIds, documentId],
        })),
    }
  })
}

export type ChatThreadStore = ReturnType<typeof createChatThreadStore>

export function isStreaming(state: Pick<ChatThreadState, "streaming">, threadId: string) {
  return state.streaming.some((target) => target.threadId === threadId)
}

export function threadsOfDocument(threads: readonly ChatThreadSummary[], documentId: string) {
  return threads.filter(
    (thread) => thread.documentId === documentId && thread.parentThreadId === null,
  )
}

export function sideChatsOf(threads: readonly ChatThreadSummary[], parentThreadId: string) {
  return threads
    .filter((thread) => thread.parentThreadId === parentThreadId)
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
}

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

function targetOf(thread: ChatThreadSummary): ChatThreadTarget {
  return {
    documentId: thread.documentId,
    threadId: thread.id,
    isDraft: false,
    parentThreadId: thread.parentThreadId,
  }
}

function withoutThread(targets: readonly ChatThreadTarget[], threadId: string) {
  return targets.filter((target) => target.threadId !== threadId)
}

function mostRecentlyViewed(threads: readonly ChatThreadSummary[]) {
  return threads.reduce<ChatThreadSummary | null>(
    (best, thread) =>
      !best || thread.lastViewedAt.localeCompare(best.lastViewedAt) > 0 ? thread : best,
    null,
  )
}

function sortThreads(threads: readonly ChatThreadSummary[]) {
  return [...threads].toSorted(compareChatThreadsByActivity)
}
