import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

test("sends the saved key, selected model, effort and conversation to OpenRouter", async ({
  application,
}) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async (input, init) => {
      if (typeof init?.body !== "string") throw new Error("Expected a JSON request body")

      Reflect.set(globalThis, "chatRequest", {
        url: input,
        headers: init?.headers,
        body: JSON.parse(init.body),
      })
      return new Response(
        'data: {"choices":[{"delta":{"content":"Hello from OpenRouter"}}]}\n\ndata: [DONE]\n\n',
        { headers: { "Content-Type": "text/event-stream" } },
      )
    }
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await reader.chatModelButton.click()
  await reader.chatModelOption("GPT-5.4 Mini").click()
  await reader.chatEffortButton.click()
  await reader.chatEffortOption("High").click()
  await reader.writeChatMessage("Hello")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatThread.getByText("Hello from OpenRouter", { exact: true })).toBeVisible()
  await reader.writeChatMessage("Continue")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatThread.getByText("Hello from OpenRouter", { exact: true })).toHaveCount(2)

  expect(
    await application.electronApplication.evaluate(() => Reflect.get(globalThis, "chatRequest")),
  ).toMatchObject({
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: { authorization: "Bearer sk-or-test", "content-type": "application/json" },
    body: {
      model: "openai/gpt-5.4-mini",
      stream: true,
      stream_options: { include_usage: true },
      reasoning: { effort: "high" },
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hello from OpenRouter" },
        { role: "user", content: "Continue" },
      ],
    },
  })
})

test("streams the Assistant Message before the provider finishes", async ({ application }) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    const encoder = new TextEncoder()

    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            Reflect.set(globalThis, "chatStreamController", controller)
            Reflect.set(globalThis, "chatStreamEncoder", encoder)
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      )
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Hello")
  await reader.chatSendMessageButton.click()
  await expect
    .poll(() =>
      application.electronApplication.evaluate(() =>
        Boolean(Reflect.get(globalThis, "chatStreamController")),
      ),
    )
    .toBe(true)

  await application.electronApplication.evaluate(() => {
    const controller = Reflect.get(globalThis, "chatStreamController")
    const encoder = Reflect.get(globalThis, "chatStreamEncoder")
    controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n'))
  })
  await expect(reader.chatThread.getByText("Hel", { exact: true })).toBeVisible()

  await application.electronApplication.evaluate(() => {
    const controller = Reflect.get(globalThis, "chatStreamController")
    const encoder = Reflect.get(globalThis, "chatStreamEncoder")
    controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n'))
    controller.enqueue(encoder.encode("data: [DONE]\n\n"))
    controller.close()
  })
  await expect(reader.chatThread.getByText("Hello", { exact: true })).toBeVisible()
  await expect(reader.chatPanel.getByRole("button", { name: "Stop response" })).toBeHidden()
})

test("reports model provenance and normalized usage when streaming finishes", async ({
  application,
}) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async () =>
      new Response(
        [
          'data: {"choices":[{"delta":{"content":"Hello"}}]}',
          'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":4,"total_tokens":16}}',
          "data: [DONE]",
          "",
        ].join("\n\n"),
        { headers: { "Content-Type": "text/event-stream" } },
      )
  })

  const events = await application.page.evaluate(
    () =>
      new Promise((resolve) => {
        const received: unknown[] = []
        window.pdfantom.streamChat(
          {
            id: crypto.randomUUID(),
            conversationId: crypto.randomUUID(),
            source: "openrouter",
            model: "openai/gpt-5.4-mini",
            messages: [{ id: "m1", role: "user", content: "Hello" }],
          },
          (event) => {
            received.push(event)
            if (event.type !== "done") return

            resolve(received)
          },
        )
      }),
  )

  expect(events).toEqual([
    { type: "delta", text: "Hello" },
    {
      type: "done",
      metadata: {
        source: "openrouter",
        model: "openai/gpt-5.4-mini",
        usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
      },
    },
  ])
})

test("closes the chat transport after a terminal event", async ({ application }) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async (_input, init) => {
      init?.signal?.addEventListener(
        "abort",
        () => Reflect.set(globalThis, "terminalChatTransportClosed", true),
        { once: true },
      )

      return new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n', {
        headers: { "Content-Type": "text/event-stream" },
      })
    }
  })

  await application.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.pdfantom.streamChat(
          {
            id: crypto.randomUUID(),
            conversationId: crypto.randomUUID(),
            source: "openrouter",
            model: "openai/gpt-5.4-mini",
            messages: [{ id: "m1", role: "user", content: "Hello" }],
          },
          (event) => {
            if (event.type === "done") resolve()
          },
        )
      }),
  )

  await expect
    .poll(() =>
      application.electronApplication.evaluate(() =>
        Reflect.get(globalThis, "terminalChatTransportClosed"),
      ),
    )
    .toBe(true)
})

test("Stop cancels OpenRouter and retains the partial Assistant Message", async ({
  application,
}) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    const encoder = new TextEncoder()

    globalThis.fetch = async (_input, init) =>
      new Response(
        new ReadableStream({
          start(controller) {
            Reflect.set(globalThis, "chatStreamController", controller)
            Reflect.set(globalThis, "chatStreamEncoder", encoder)
            init?.signal?.addEventListener(
              "abort",
              () => {
                Reflect.set(globalThis, "chatAborted", true)
                controller.error(new DOMException("Aborted", "AbortError"))
              },
              { once: true },
            )
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      )
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Hello")
  await reader.chatSendMessageButton.click()
  await expect
    .poll(() =>
      application.electronApplication.evaluate(() =>
        Boolean(Reflect.get(globalThis, "chatStreamController")),
      ),
    )
    .toBe(true)
  await application.electronApplication.evaluate(() => {
    const controller = Reflect.get(globalThis, "chatStreamController")
    const encoder = Reflect.get(globalThis, "chatStreamEncoder")
    controller.enqueue(
      encoder.encode('data: {"choices":[{"delta":{"content":"Partial answer"}}]}\n\n'),
    )
  })
  await expect(reader.chatThread.getByText("Partial answer", { exact: true })).toBeVisible()

  await reader.chatPanel.getByRole("button", { name: "Stop response" }).click()
  await expect
    .poll(() =>
      application.electronApplication.evaluate(() => Reflect.get(globalThis, "chatAborted")),
    )
    .toBe(true)
  await expect(reader.chatThread.getByText("Partial answer", { exact: true })).toBeVisible()
  await expect(reader.chatThread.getByText("Partial answer", { exact: true })).toHaveAttribute(
    "data-status",
    "incomplete",
  )
  await expect(reader.chatPanel.getByRole("button", { name: "Regenerate response" })).toBeEnabled()
  await expect(
    reader.chatThread.getByText("Unable to generate response. Please try again later."),
  ).toBeHidden()
})

test("counts up the elapsed time while waiting for the first token", async ({ application }) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    const encoder = new TextEncoder()

    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            Reflect.set(globalThis, "chatStreamController", controller)
            Reflect.set(globalThis, "chatStreamEncoder", encoder)
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      )
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Ping")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatThinkingIndicator).toHaveText(/^Thinking for \ds$/)
  await expect(reader.chatThinkingIndicator).toHaveText("Thinking for 2s")

  await application.electronApplication.evaluate(() => {
    const controller = Reflect.get(globalThis, "chatStreamController")
    const encoder = Reflect.get(globalThis, "chatStreamEncoder")
    controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Pong"}}]}\n\n'))
    controller.enqueue(encoder.encode("data: [DONE]\n\n"))
    controller.close()
  })
  await expect(reader.chatThread.getByText("Pong", { exact: true })).toBeVisible()
  await expect(reader.chatThinkingIndicator).toBeHidden()
})
