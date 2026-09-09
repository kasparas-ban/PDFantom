import { expect, test } from "vitest"

import {
  createChatThreadStore,
  isStreaming,
  isStreamingWithin,
  sideChatsOf,
  threadsOfDocument,
  visibleThreadsOfDocument,
} from "../../src/renderer/src/sidebar/chat-thread-store"
import type { ChatThreadSummary } from "../../src/shared/chat-thread-api"

const thread = (
  id: string,
  documentId: string,
  lastMessageAt: string,
  lastViewedAt = lastMessageAt,
  parentThreadId: string | null = null,
): ChatThreadSummary => ({
  id,
  documentId,
  title: id,
  createdAt: lastMessageAt,
  lastMessageAt,
  lastViewedAt,
  selection: null,
  parentThreadId,
})

const sideChat = (
  id: string,
  parentThreadId: string,
  createdAt: string,
  lastViewedAt = createdAt,
) => thread(id, "doc", createdAt, lastViewedAt, parentThreadId)

const createStore = () => {
  let next = 0
  return createChatThreadStore(() => `draft-${++next}`)
}

const target = (
  threadId: string,
  documentId: string | null = "doc",
  parentThreadId: string | null = null,
) => ({
  documentId,
  threadId,
  isDraft: false,
  parentThreadId,
})

const draft = (
  threadId: string,
  documentId: string | null = "doc",
  parentThreadId: string | null = null,
) => ({
  ...target(threadId, documentId, parentThreadId),
  isDraft: true,
})

test("showing a Document opens its most recently viewed Chat Thread", () => {
  const store = createStore()
  store
    .getState()
    .hydrate([
      thread("recent-message", "doc", "2026-09-03T10:00:00.000Z", "2026-09-01T10:00:00.000Z"),
      thread("recent-view", "doc", "2026-09-02T10:00:00.000Z", "2026-09-04T10:00:00.000Z"),
    ])

  store.getState().showDocument("doc")

  expect(store.getState().active).toEqual(target("recent-view"))
})

test("showing a Document without Chat Threads starts a Draft, and showing it again keeps it", () => {
  const store = createStore()
  store.getState().hydrate([])

  store.getState().showDocument("doc")
  const first = store.getState().active
  store.getState().showDocument("doc")

  expect(first).toEqual(draft("draft-1"))
  expect(store.getState().active).toBe(first)
  expect(store.getState().activeSideChat).toBeNull()
})

test("a Draft becomes a Chat Thread when its summary arrives and gains a Side Chat Draft", () => {
  const store = createStore()
  store.getState().hydrate([])
  store.getState().startDraft("doc")
  const { threadId } = store.getState().active!

  store.getState().upsertThread(thread(threadId, "doc", "2026-09-03T10:00:00.000Z"))

  expect(store.getState().active).toEqual(target(threadId))
  expect(store.getState().activeSideChat).toEqual(draft("draft-2", "doc", threadId))
  expect(store.getState().threads.map((item) => item.id)).toEqual([threadId])
})

test("removing the visible Chat Thread leaves a Draft on the same Document", () => {
  const store = createStore()
  store
    .getState()
    .hydrate([
      thread("only", "doc", "2026-09-03T10:00:00.000Z"),
      sideChat("side", "only", "2026-09-03T11:00:00.000Z"),
    ])
  store.getState().showDocument("doc")
  store.getState().setStreaming(store.getState().active!, true)
  store.getState().setStreaming(store.getState().activeSideChat!, true)

  store.getState().removeThread("only")

  expect(store.getState().threads).toEqual([])
  expect(store.getState().streaming).toEqual([])
  expect(store.getState().active).toEqual(draft("draft-1"))
  expect(store.getState().activeSideChat).toBeNull()
})

test("detaching yields one detached Draft", () => {
  const store = createStore()
  store.getState().hydrate([])

  store.getState().detach()
  const detached = store.getState().active
  store.getState().detach()

  expect(detached).toEqual(draft("draft-1", null))
  expect(store.getState().active).toBe(detached)
})

test("streaming keeps the whole target, so a Draft in flight is never rebuilt from the list", () => {
  const store = createStore()
  store.getState().hydrate([])
  store.getState().startDraft("doc")
  const active = store.getState().active!

  store.getState().setStreaming(active, true)
  store.getState().setStreaming(active, true)
  store.getState().showDocument("other")

  expect(store.getState().streaming).toEqual([active])
  store.getState().setStreaming(active, false)
  expect(store.getState().streaming).toEqual([])
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

test("Side Chats stay out of the sidebar and are listed under their parent in creation order", () => {
  const threads = [
    thread("parent", "doc", "2026-09-01T10:00:00.000Z"),
    sideChat("second", "parent", "2026-09-03T10:00:00.000Z"),
    sideChat("first", "parent", "2026-09-02T10:00:00.000Z"),
    sideChat("elsewhere", "other-parent", "2026-09-02T10:00:00.000Z"),
  ]

  expect(threadsOfDocument(threads, "doc").map((item) => item.id)).toEqual(["parent"])
  expect(sideChatsOf(threads, "parent").map((item) => item.id)).toEqual(["first", "second"])
})

test("opening a parent activates its most recently viewed Side Chat", () => {
  const store = createStore()
  const parent = thread("parent", "doc", "2026-09-01T10:00:00.000Z")
  store
    .getState()
    .hydrate([
      parent,
      sideChat("older-view", "parent", "2026-09-02T10:00:00.000Z", "2026-09-02T10:00:00.000Z"),
      sideChat("newer-view", "parent", "2026-09-01T12:00:00.000Z", "2026-09-05T10:00:00.000Z"),
    ])

  store.getState().openThread(parent)

  expect(store.getState().activeSideChat).toEqual(target("newer-view", "doc", "parent"))
})

test("the plus button starts a Side Chat Draft that becomes a Side Chat when its row arrives", () => {
  const store = createStore()
  const parent = thread("parent", "doc", "2026-09-01T10:00:00.000Z")
  store.getState().hydrate([parent, sideChat("existing", "parent", "2026-09-02T10:00:00.000Z")])
  store.getState().openThread(parent)

  store.getState().startSideChatDraft()
  const sideDraft = store.getState().activeSideChat!
  store.getState().upsertThread(sideChat(sideDraft.threadId, "parent", "2026-09-03T10:00:00.000Z"))

  expect(sideDraft).toEqual(draft("draft-1", "doc", "parent"))
  expect(store.getState().activeSideChat).toEqual(target("draft-1", "doc", "parent"))
  expect(store.getState().active).toEqual(target("parent"))
})

test("closing a Side Chat activates the tab to its right, then the left, then a fresh Draft", () => {
  const store = createStore()
  const parent = thread("parent", "doc", "2026-09-01T10:00:00.000Z")
  const first = sideChat("first", "parent", "2026-09-02T10:00:00.000Z")
  const second = sideChat("second", "parent", "2026-09-03T10:00:00.000Z")
  const third = sideChat("third", "parent", "2026-09-04T10:00:00.000Z")
  store.getState().hydrate([parent, first, second, third])
  store.getState().openThread(parent)
  store.getState().openSideChat(second)

  store.getState().removeSideChat("second")
  expect(store.getState().activeSideChat).toEqual(target("third", "doc", "parent"))

  store.getState().removeSideChat("third")
  expect(store.getState().activeSideChat).toEqual(target("first", "doc", "parent"))

  store.getState().removeSideChat("first")
  expect(store.getState().activeSideChat).toEqual(draft("draft-1", "doc", "parent"))
  expect(store.getState().threads).toEqual([parent])
})

test("closing the Side Chat Draft falls back to the last stored Side Chat", () => {
  const store = createStore()
  const parent = thread("parent", "doc", "2026-09-01T10:00:00.000Z")
  const first = sideChat("first", "parent", "2026-09-02T10:00:00.000Z")
  const second = sideChat("second", "parent", "2026-09-03T10:00:00.000Z")
  store.getState().hydrate([parent, first, second])
  store.getState().openThread(parent)
  store.getState().startSideChatDraft()

  store.getState().removeSideChat(store.getState().activeSideChat!.threadId)

  expect(store.getState().activeSideChat).toEqual(target("second", "doc", "parent"))
})

test("asking in a side chat keeps the Quote until the Side Chat composer takes it", () => {
  const store = createStore()
  const parent = thread("parent", "doc", "2026-09-01T10:00:00.000Z")
  store.getState().hydrate([parent])
  store.getState().openThread(parent)
  const quote = { text: "keepalives at 20", messageId: "a1" }

  store.getState().askInSideChat(quote)

  expect(store.getState().pendingSideChatQuote).toEqual(quote)
  expect(store.getState().activeSideChat).toEqual(draft("draft-1", "doc", "parent"))

  store.getState().takeSideChatQuote()
  expect(store.getState().pendingSideChatQuote).toBeNull()
})

test("a streaming Side Chat counts as activity within its parent, not as the parent streaming", () => {
  const store = createStore()
  store
    .getState()
    .hydrate([
      thread("parent", "doc", "2026-09-03T10:00:00.000Z"),
      sideChat("side", "parent", "2026-09-03T11:00:00.000Z"),
    ])
  store.getState().showDocument("doc")

  store.getState().setStreaming(store.getState().activeSideChat!, true)

  expect(isStreaming(store.getState(), "parent")).toBe(false)
  expect(isStreaming(store.getState(), "side")).toBe(true)
  expect(isStreamingWithin(store.getState(), "parent")).toBe(true)
  expect(isStreamingWithin(store.getState(), "side")).toBe(true)
})
