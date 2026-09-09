import type { ThreadMessage } from "@assistant-ui/react"
import { expect, test, vi } from "vitest"

import {
  createChatHistoryAdapter,
  toChatThreadMessage,
  toThreadMessageLike,
} from "../../src/renderer/src/sidebar/chat-history-adapter"
import {
  createQuoteAttachment,
  toCompleteQuoteAttachment,
} from "../../src/renderer/src/sidebar/chat-quote"
import type { ChatThreadSummary } from "../../src/shared/chat-thread-api"

const summary: ChatThreadSummary = {
  id: "thread-1",
  documentId: "doc-1",
  title: "Hello",
  createdAt: "2026-09-07T10:00:00.000Z",
  lastMessageAt: "2026-09-07T10:00:00.000Z",
  lastViewedAt: "2026-09-07T10:00:00.000Z",
  selection: { model: "openai/gpt-5.4-mini", source: "openrouter", effort: "high" },
  parentThreadId: null,
}

const userMessage = (id: string, text: string): ThreadMessage => ({
  id,
  role: "user",
  createdAt: new Date("2026-09-07T10:00:00.000Z"),
  content: [{ type: "text", text }],
  attachments: [],
  metadata: { custom: {} },
})

const assistantMessage = (
  id: string,
  text: string,
  status: ThreadMessage["status"] & object,
): ThreadMessage => ({
  id,
  role: "assistant",
  createdAt: new Date("2026-09-07T10:00:05.000Z"),
  content: [{ type: "text", text }],
  status,
  metadata: {
    unstable_state: null,
    unstable_annotations: [],
    unstable_data: [],
    steps: [],
    custom: {
      generation: {
        source: "openrouter",
        model: "openai/gpt-5.4-mini",
        usage: { inputTokens: 3, outputTokens: 2 },
      },
    },
  },
})

test("a Draft creates its Chat Thread on the first user message and appends afterwards", async () => {
  const createChatThread = vi.fn(async () => summary)
  const appendChatMessage = vi.fn(async () => summary)
  const onThreadChanged = vi.fn()
  const adapter = createChatHistoryAdapter({
    platform: { loadChatThread: async () => null, createChatThread, appendChatMessage },
    threadId: "thread-1",
    documentId: "doc-1",
    isDraft: true,
    getSelection: () => ({ model: "openai/gpt-5.4-mini", source: "openrouter", effort: "high" }),
    onThreadChanged,
  })

  expect(await adapter.load()).toEqual({ messages: [] })

  await adapter.append({ parentId: null, message: userMessage("u1", "Hello") })
  await adapter.append({
    parentId: "u1",
    message: assistantMessage("a1", "Hi", { type: "complete", reason: "stop" }),
  })

  expect(createChatThread).toHaveBeenCalledWith({
    id: "thread-1",
    documentId: "doc-1",
    message: {
      id: "u1",
      role: "user",
      content: "Hello",
      status: { type: "complete" },
      createdAt: "2026-09-07T10:00:00.000Z",
    },
    selection: { model: "openai/gpt-5.4-mini", source: "openrouter", effort: "high" },
  })
  expect(appendChatMessage).toHaveBeenCalledWith({
    threadId: "thread-1",
    parentId: "u1",
    message: {
      id: "a1",
      role: "assistant",
      content: "Hi",
      status: { type: "complete" },
      createdAt: "2026-09-07T10:00:05.000Z",
      generation: {
        source: "openrouter",
        model: "openai/gpt-5.4-mini",
        usage: { inputTokens: 3, outputTokens: 2 },
      },
    },
  })
  expect(onThreadChanged).toHaveBeenCalledTimes(2)
})

test("a detached Draft never writes", async () => {
  const createChatThread = vi.fn(async () => summary)
  const adapter = createChatHistoryAdapter({
    platform: {
      loadChatThread: async () => null,
      createChatThread,
      appendChatMessage: async () => summary,
    },
    threadId: "thread-1",
    documentId: null,
    isDraft: true,
    getSelection: () => ({ model: "openrouter/free", source: "openrouter" }),
    onThreadChanged: () => {},
  })

  await adapter.append({ parentId: null, message: userMessage("u1", "Hello") })

  expect(createChatThread).not.toHaveBeenCalled()
})

test("loads a persisted Chat Thread as a linear repository with statuses and provenance", async () => {
  const adapter = createChatHistoryAdapter({
    platform: {
      loadChatThread: async () => ({
        thread: summary,
        messages: [
          {
            id: "u1",
            role: "user",
            content: "Hello",
            status: { type: "complete" },
            createdAt: "2026-09-07T10:00:00.000Z",
          },
          {
            id: "a1",
            role: "assistant",
            content: "Partial",
            status: { type: "incomplete", error: "Insufficient credits" },
            createdAt: "2026-09-07T10:00:05.000Z",
            generation: { source: "openrouter", model: "openai/gpt-5.4-mini" },
          },
        ],
      }),
      createChatThread: async () => summary,
      appendChatMessage: async () => summary,
    },
    threadId: "thread-1",
    documentId: "doc-1",
    isDraft: false,
    getSelection: () => ({ model: "openrouter/free", source: "openrouter" }),
    onThreadChanged: () => {},
  })

  const repository = await adapter.load()

  expect(repository.messages.at(-1)?.message.id).toBe("a1")
  expect(repository.messages.map((item) => [item.parentId, item.message.id])).toEqual([
    [null, "u1"],
    ["u1", "a1"],
  ])
  expect(repository.messages[1].message).toMatchObject({
    role: "assistant",
    status: { type: "incomplete", reason: "error", error: "Insufficient credits" },
    metadata: { custom: { generation: { source: "openrouter", model: "openai/gpt-5.4-mini" } } },
  })
})

test("round-trips a stopped reply as cancelled", () => {
  const stopped = toChatThreadMessage(
    assistantMessage("a1", "Partial", { type: "incomplete", reason: "cancelled" }),
  )

  expect(stopped).toMatchObject({ status: { type: "incomplete" } })
  expect(toThreadMessageLike(stopped!)).toMatchObject({
    status: { type: "incomplete", reason: "cancelled" },
  })
})

test("round-trips Quotes between user message attachments and the persisted shape", () => {
  const sent: ThreadMessage = {
    ...userMessage("u2", "Why 20?"),
    attachments: [
      {
        ...createQuoteAttachment({ text: "keepalives at 20", messageId: "a1" }),
        id: "quote-1",
        type: "quote",
        status: { type: "complete" },
      },
      { id: "file-1", type: "file", name: "notes.txt", content: [], status: { type: "complete" } },
    ],
  }

  const persisted = toChatThreadMessage(sent)

  expect(persisted).toEqual({
    id: "u2",
    role: "user",
    content: "Why 20?",
    status: { type: "complete" },
    createdAt: "2026-09-07T10:00:00.000Z",
    quotes: [{ text: "keepalives at 20", messageId: "a1" }],
  })
  expect(toThreadMessageLike(persisted!)).toEqual({
    id: "u2",
    role: "user",
    createdAt: new Date("2026-09-07T10:00:00.000Z"),
    content: [{ type: "text", text: "Why 20?" }],
    attachments: [
      toCompleteQuoteAttachment({ text: "keepalives at 20", messageId: "a1" }, "u2:quote:0"),
    ],
  })
  expect(toChatThreadMessage(userMessage("u3", "Plain"))).not.toHaveProperty("quotes")
  expect(
    toThreadMessageLike({
      id: "u3",
      role: "user",
      content: "Plain",
      status: { type: "complete" },
      createdAt: "2026-09-07T10:00:00.000Z",
    }),
  ).toMatchObject({ attachments: [] })
})
