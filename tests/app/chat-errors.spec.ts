import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

for (const { status, body, message } of [
  {
    status: 402,
    body: JSON.stringify({ error: { message: "Insufficient credits" } }),
    message: "Insufficient credits",
  },
  {
    status: 429,
    body: JSON.stringify({ error: { message: "Rate limit exceeded" } }),
    message: "Rate limit exceeded",
  },
  {
    status: 500,
    body: JSON.stringify({ error: { message: "Provider unavailable" } }),
    message: "Provider unavailable",
  },
  {
    status: 502,
    body: "Bad gateway",
    message: "Unable to generate response. Please try again later.",
  },
  {
    status: 400,
    body: JSON.stringify({ error: { message: " " } }),
    message: "Unable to generate response. Please try again later.",
  },
]) {
  test(`shows the API message or fallback for HTTP ${status}`, async ({ application }) => {
    await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
    await application.electronApplication.evaluate(
      (_electron, response) => {
        globalThis.fetch = async () => new Response(response.body, { status: response.status })
      },
      { status, body },
    )

    const reader = new DocumentReaderDriver(application.page)
    await reader.toggleChatPanel("Show")
    await reader.writeChatMessage("Summarize this document")
    await reader.chatSendMessageButton.click()

    await expect(reader.chatPanel.getByText(message, { exact: true })).toBeVisible()
    await expect(reader.chatSendMessageButton).toBeDisabled()
  })
}

test("retains a partial Assistant Message when the provider stream fails", async ({
  application,
}) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async () =>
      new Response(
        [
          'data: {"choices":[{"delta":{"content":"Partial answer"}}]}',
          'data: {"error":{"code":500,"message":"Provider disconnected"}}',
          "data: [DONE]",
          "",
        ].join("\n\n"),
        { headers: { "Content-Type": "text/event-stream" } },
      )
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Hello")
  await reader.chatSendMessageButton.click()

  await expect(reader.chatPanel.getByText("Partial answer", { exact: true })).toBeVisible()
  await expect(reader.chatPanel.getByText("Provider disconnected", { exact: true })).toBeVisible()
})

test("does not expose unexpected transport errors", async ({ application }) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async () => {
      throw new Error("connect ECONNREFUSED /Users/student/private.sock")
    }
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Hello")
  await reader.chatSendMessageButton.click()

  await expect(
    reader.chatPanel.getByText("Unable to generate response. Please try again later.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(reader.chatPanel.getByText(/private\.sock/)).toBeHidden()
})

for (const retry of ["send", "regenerate"] as const) {
  test(`uses the free model on the first ${retry} after a paid model fails`, async ({
    application,
  }) => {
    await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
    await application.electronApplication.evaluate(() => {
      const models: string[] = []
      Reflect.set(globalThis, "chatModels", models)
      globalThis.fetch = async (_input, init) => {
        if (typeof init?.body !== "string") throw new Error("Expected a JSON request body")

        const { model } = JSON.parse(init.body)
        models.push(model)
        if (model !== "nvidia/nemotron-3-ultra-550b-a55b:free") {
          return Response.json({ error: { message: "Insufficient credits" } }, { status: 402 })
        }

        return new Response(
          'data: {"choices":[{"delta":{"content":"Hello from Nemotron"}}]}\n\ndata: [DONE]\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        )
      }
    })

    const reader = new DocumentReaderDriver(application.page)
    await reader.toggleChatPanel("Show")
    await reader.chatModelButton.click()
    await reader.chatModelOption("GPT-5.4 Nano").click()
    await reader.writeChatMessage("Hello")
    await reader.chatSendMessageButton.click()
    await expect(reader.chatPanel.getByText("Insufficient credits", { exact: true })).toBeVisible()
    await reader.chatModelButton.click()
    await reader.chatModelOption("Nemotron 3 Ultra (free)").click()

    if (retry === "send") {
      await reader.writeChatMessage("Try again")
      await reader.chatSendMessageButton.click()
    } else {
      await reader.chatPanel.getByRole("button", { name: "Regenerate response" }).click()
    }

    await expect
      .poll(() =>
        application.electronApplication.evaluate(() => Reflect.get(globalThis, "chatModels")),
      )
      .toEqual(["openai/gpt-5.4-nano", "nvidia/nemotron-3-ultra-550b-a55b:free"])
    await expect(reader.chatPanel.getByText("Hello from Nemotron", { exact: true })).toBeVisible()
    await expect(reader.chatPanel.getByText("Hello", { exact: true })).toBeVisible()
  })
}

test("rejects malformed chat requests without contacting OpenRouter", async ({ application }) => {
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async () => {
      Reflect.set(globalThis, "unexpectedChatRequest", true)
      throw new Error("Unexpected request")
    }
  })
  const result = await application.page.evaluate(
    () =>
      new Promise((resolve) => {
        window.pdfantom.streamChat(
          {
            id: "invalid",
            conversationId: "invalid",
            source: "openrouter",
            model: "",
            messages: [],
          },
          (event) => {
            resolve(event)
          },
        )
      }),
  )
  expect(result).toEqual({
    type: "error",
    message: "Unable to generate response. Please try again later.",
  })
  const missingKey = await application.page.evaluate(
    () =>
      new Promise((resolve) => {
        window.pdfantom.streamChat(
          {
            id: crypto.randomUUID(),
            conversationId: crypto.randomUUID(),
            source: "openrouter",
            model: "openai/gpt-5.4-nano",
            messages: [{ id: "m1", role: "user", content: "Hello" }],
          },
          (event) => {
            resolve(event)
          },
        )
      }),
  )
  expect(missingKey).toEqual({ type: "error", message: "Connect an AI provider" })
  expect(
    await application.electronApplication.evaluate(() =>
      Reflect.get(globalThis, "unexpectedChatRequest"),
    ),
  ).toBeUndefined()
})
