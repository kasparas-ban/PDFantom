import { expect, test } from "vitest"

import {
  compareChatThreadsByActivity,
  deriveChatThreadTitle,
  type ChatThreadSummary,
} from "../../src/shared/chat-thread-api"

test("derives the title from the first non-empty line with collapsed whitespace", () => {
  expect(deriveChatThreadTitle("\n\n  Explain   the\tsecond   theorem \nplease")).toBe(
    "Explain the second theorem",
  )
})

test("falls back to a neutral title for blank messages", () => {
  expect(deriveChatThreadTitle("   \n ")).toBe("New chat")
})

test("truncates long titles at a word boundary with an ellipsis", () => {
  const title = deriveChatThreadTitle(
    "Could you walk me through how the proof of the central limit theorem handles dependence",
  )

  expect(title.length).toBeLessThanOrEqual(60)
  expect(title.endsWith("…")).toBe(true)
  expect(title).toBe("Could you walk me through how the proof of the central…")
})

const thread = (id: string, lastMessageAt: string): ChatThreadSummary => ({
  id,
  documentId: "document",
  title: id,
  createdAt: lastMessageAt,
  lastMessageAt,
  lastViewedAt: lastMessageAt,
  selection: null,
})

test("orders Chat Threads by last message, newest first", () => {
  const sorted = [
    thread("old", "2026-09-01T10:00:00.000Z"),
    thread("new", "2026-09-03T10:00:00.000Z"),
    thread("mid", "2026-09-02T10:00:00.000Z"),
  ].toSorted(compareChatThreadsByActivity)

  expect(sorted.map((item) => item.id)).toEqual(["new", "mid", "old"])
})
