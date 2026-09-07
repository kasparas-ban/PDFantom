import { expect, test } from "vitest"

import type { ChatThreadSummary } from "../../src/shared/chat-thread-api"
import {
  createChatThreadStore,
  visibleThreadsOfDocument,
} from "../../src/renderer/src/sidebar/chat-thread-store"

const thread = (
  id: string,
  documentId: string,
  lastMessageAt: string,
  lastViewedAt = lastMessageAt,
): ChatThreadSummary => ({
  id,
  documentId,
  title: id,
  createdAt: lastMessageAt,
  lastMessageAt,
  lastViewedAt,
  selection: null,
})

const createStore = () => {
  let next = 0
  return createChatThreadStore(() => `draft-${++next}`)
}

test("showing a Document opens its most recently viewed Chat Thread", () => {
  const store = createStore()
  store.getState().hydrate([
    thread("recent-message", "doc", "2026-09-03T10:00:00.000Z", "2026-09-01T10:00:00.000Z"),
    thread("recent-view", "doc", "2026-09-02T10:00:00.000Z", "2026-09-04T10:00:00.000Z"),
  ])

  store.getState().showDocument("doc")

  expect(store.getState().active).toEqual({
    documentId: "doc",
    threadId: "recent-view",
    isDraft: false,
  })
})

test("showing a Document without Chat Threads starts a Draft, and showing it again keeps it", () => {
  const store = createStore()
  store.getState().hydrate([])

  store.getState().showDocument("doc")
  const first = store.getState().active
  store.getState().showDocument("doc")

  expect(first).toEqual({ documentId: "doc", threadId: "draft-1", isDraft: true })
  expect(store.getState().active).toBe(first)
})

test("a Draft becomes a Chat Thread when its summary arrives", () => {
  const store = createStore()
  store.getState().hydrate([])
  store.getState().startDraft("doc")
  const { threadId } = store.getState().active!

  store.getState().upsertThread(thread(threadId, "doc", "2026-09-03T10:00:00.000Z"))

  expect(store.getState().active).toEqual({ documentId: "doc", threadId, isDraft: false })
  expect(store.getState().threads.map((item) => item.id)).toEqual([threadId])
})

test("removing the visible Chat Thread leaves a Draft on the same Document", () => {
  const store = createStore()
  store.getState().hydrate([thread("only", "doc", "2026-09-03T10:00:00.000Z")])
  store.getState().showDocument("doc")
  store.getState().setStreaming("only", true)

  store.getState().removeThread("only")

  expect(store.getState().threads).toEqual([])
  expect(store.getState().streamingThreadIds).toEqual([])
  expect(store.getState().active).toEqual({ documentId: "doc", threadId: "draft-1", isDraft: true })
})

test("clearing the active target yields one detached Draft", () => {
  const store = createStore()
  store.getState().hydrate([])

  store.getState().clearActive()
  const detached = store.getState().active
  store.getState().clearActive()

  expect(detached).toEqual({ documentId: null, threadId: "draft-1", isDraft: true })
  expect(store.getState().active).toBe(detached)
})

test("visible rows show the five most recent and always include the active thread", () => {
  const threads = Array.from({ length: 8 }, (_, index) =>
    thread(`t${index}`, "doc", `2026-09-0${8 - index}T10:00:00.000Z`),
  )

  const collapsed = visibleThreadsOfDocument(threads, "doc", "t7", false)
  const revealed = visibleThreadsOfDocument(threads, "doc", "t7", true)

  expect(collapsed.visible.map((item) => item.id)).toEqual(["t0", "t1", "t2", "t3", "t4", "t7"])
  expect(collapsed.hidden).toBe(2)
  expect(revealed.visible).toHaveLength(8)
  expect(revealed.hidden).toBe(0)
})
