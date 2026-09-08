import type { ChatModelRunOptions, CompleteAttachment } from "@assistant-ui/react"
import { expect, test, vi } from "vitest"

import { createChatModelAdapter } from "../../src/renderer/src/sidebar/chat-model-adapter"
import { createQuoteAttachment } from "../../src/renderer/src/sidebar/chat-quote"
import type { ChatApi, ChatRequest, ChatStreamEvent } from "../../src/shared/chat-api"

test("preserves provider provenance and terminal metadata in the final update", async () => {
  let receivedRequest: ChatRequest | undefined
  const events: ChatStreamEvent[] = [
    { type: "delta", text: "Hel" },
    { type: "delta", text: "lo" },
    {
      type: "done",
      metadata: {
        source: "openrouter",
        model: "openai/gpt-5.4-nano",
        usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
      },
    },
  ]
  const streamChat: ChatApi["streamChat"] = (request, onEvent) => {
    receivedRequest = request
    queueMicrotask(() => events.forEach(onEvent))

    return vi.fn()
  }
  const adapter = createChatModelAdapter(
    { streamChat },
    () => ({ model: "openai/gpt-5.4-nano", effort: "medium", source: "openrouter" }),
    "conversation-1",
  )
  const updates = []

  for await (const update of adapter.run(createRunOptions())) updates.push(update)

  expect(receivedRequest).toMatchObject({
    conversationId: "conversation-1",
    source: "openrouter",
    model: "openai/gpt-5.4-nano",
    effort: "medium",
    messages: [{ id: "user-message", role: "user", content: "Hello" }],
  })
  expect(updates).toEqual([
    { content: [{ type: "text", text: "Hel" }] },
    { content: [{ type: "text", text: "Hello" }] },
    {
      content: [{ type: "text", text: "Hello" }],
      metadata: {
        custom: {
          generation: {
            source: "openrouter",
            model: "openai/gpt-5.4-nano",
            usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
          },
        },
      },
    },
  ])
})

test("prepends Quote attachments to the user message the provider receives", async () => {
  let receivedRequest: ChatRequest | undefined
  const streamChat: ChatApi["streamChat"] = (request, onEvent) => {
    receivedRequest = request
    queueMicrotask(() =>
      onEvent({ type: "done", metadata: { source: "openrouter", model: "openai/gpt-5.4-nano" } }),
    )

    return vi.fn()
  }
  const adapter = createChatModelAdapter(
    { streamChat },
    () => ({ model: "openai/gpt-5.4-nano", source: "openrouter" }),
    "conversation-1",
  )
  const base = createRunOptions()
  const quote: CompleteAttachment = {
    ...createQuoteAttachment({ text: "keepalives at 20", messageId: "assistant-1" }),
    id: "quote-1",
    type: "quote",
    status: { type: "complete" },
  }
  const options: ChatModelRunOptions = {
    ...base,
    messages: [
      {
        id: "user-message",
        role: "user",
        content: [{ type: "text", text: "Hello" }],
        attachments: [quote],
        metadata: { custom: {} },
        createdAt: new Date(),
      },
    ],
  }

  for await (const update of adapter.run(options)) void update

  expect(receivedRequest?.messages).toEqual([
    {
      id: "user-message",
      role: "user",
      content: "Quoting from the conversation:\n> keepalives at 20\n\nHello",
    },
  ])
})

test("normalizes synchronous transport setup failures", async () => {
  const adapter = createChatModelAdapter(
    {
      streamChat: () => {
        throw new Error("Electron transport failed at /Users/student/private.sock")
      },
    },
    () => ({ model: "openai/gpt-5.4-nano", effort: "medium", source: "openrouter" }),
    "conversation-1",
  )

  await expect(adapter.run(createRunOptions()).next()).rejects.toThrow(
    "Unable to generate response. Please try again later.",
  )
})

test("interrupt stops only the in-flight response with a cancellation", async () => {
  const stopTransport = vi.fn()
  const adapter = createChatModelAdapter(
    {
      streamChat: (_request, onEvent) => {
        queueMicrotask(() => onEvent({ type: "delta", text: "Partial" }))

        return stopTransport
      },
    },
    () => ({ model: "openai/gpt-5.4-nano", source: "openrouter" }),
    "conversation-1",
  )

  adapter.interrupt()

  const run = adapter.run(createRunOptions())
  await expect(run.next()).resolves.toEqual({
    done: false,
    value: { content: [{ type: "text", text: "Partial" }] },
  })

  adapter.interrupt()

  await expect(run.next()).rejects.toMatchObject({ name: "AbortError" })
  expect(stopTransport).toHaveBeenCalled()
})

function createRunOptions(): ChatModelRunOptions {
  const controller = new AbortController()

  return {
    messages: [
      {
        id: "user-message",
        role: "user",
        content: [{ type: "text", text: "Hello" }],
        attachments: [],
        metadata: { custom: {} },
        createdAt: new Date(),
      },
    ],
    runConfig: {},
    abortSignal: controller.signal,
    context: { system: "", tools: {}, callSettings: {}, config: {} },
    unstable_getMessage: () => {
      throw new Error("No assistant message is available in this adapter test")
    },
  }
}
