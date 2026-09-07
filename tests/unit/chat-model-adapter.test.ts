import type { ChatModelRunOptions } from "@assistant-ui/react"
import { expect, test, vi } from "vitest"

import { createChatModelAdapter } from "../../src/renderer/src/sidebar/chat-model-adapter"
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
