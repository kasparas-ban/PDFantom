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

test("sends the saved key, selected model and conversation to OpenRouter", async ({
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
      return Response.json({ choices: [{ message: { content: "Hello from OpenRouter" } }] })
    }
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.chatModelButton.click()
  await reader.chatModelOption("GPT-5.4 Mini").click()
  await reader.writeChatMessage("Hello")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatPanel.getByText("Hello from OpenRouter", { exact: true })).toBeVisible()
  await reader.writeChatMessage("Continue")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatPanel.getByText("Hello from OpenRouter", { exact: true })).toHaveCount(2)

  expect(
    await application.electronApplication.evaluate(() => Reflect.get(globalThis, "chatRequest")),
  ).toEqual({
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: { Authorization: "Bearer sk-or-test", "Content-Type": "application/json" },
    body: {
      model: "openai/gpt-5.4-mini",
      stream: false,
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hello from OpenRouter" },
        { role: "user", content: "Continue" },
      ],
    },
  })
})

test("Stop response cancels the OpenRouter request", async ({ application }) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async (_input, init) =>
      new Promise((_resolve, reject) => {
        Reflect.set(globalThis, "chatStarted", true)
        init?.signal?.addEventListener(
          "abort",
          () => {
            Reflect.set(globalThis, "chatAborted", true)
            reject(new Error("Aborted"))
          },
          { once: true },
        )
      })
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Hello")
  await reader.chatSendMessageButton.click()
  await expect
    .poll(() =>
      application.electronApplication.evaluate(() => Reflect.get(globalThis, "chatStarted")),
    )
    .toBe(true)
  await reader.chatPanel.getByRole("button", { name: "Stop response" }).click()
  await expect
    .poll(() =>
      application.electronApplication.evaluate(() => Reflect.get(globalThis, "chatAborted")),
    )
    .toBe(true)
  await expect(
    reader.chatPanel.getByText("Unable to generate response. Please try again later."),
  ).toBeHidden()
})

test("rejects malformed chat requests without contacting OpenRouter", async ({ application }) => {
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async () => {
      Reflect.set(globalThis, "unexpectedChatRequest", true)
      throw new Error("Unexpected request")
    }
  })
  const result = await application.page.evaluate(() =>
    window.pdfantom.generateChat({
      id: "invalid",
      model: "",
      messages: [],
    }),
  )
  expect(result).toEqual({ error: "Unable to generate response. Please try again later." })
  const missingKey = await application.page.evaluate(() =>
    window.pdfantom.generateChat({
      id: crypto.randomUUID(),
      model: "openai/gpt-5.4-nano",
      messages: [{ role: "user", content: "Hello" }],
    }),
  )
  expect(missingKey).toEqual({ error: "Connect an AI provider" })
  expect(
    await application.electronApplication.evaluate(() =>
      Reflect.get(globalThis, "unexpectedChatRequest"),
    ),
  ).toBeUndefined()
})
