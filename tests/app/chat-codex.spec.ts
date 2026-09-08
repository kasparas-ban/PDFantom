import path from "node:path"

import { readFakeCodexRequests } from "../fixtures/fake-codex/fake-codex"
import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

const SIGNED_OUT_REASON = "Run `codex login` to use ChatGPT models."

async function openChatGptModels(reader: DocumentReaderDriver) {
  await reader.toggleChatPanel("Show")
  await reader.chatModelButton.click()
  await reader.chatModelSourceTab("ChatGPT models").click()
}

async function chooseChatGptModel(reader: DocumentReaderDriver, name: string) {
  await openChatGptModels(reader)
  await reader.chatModelOption(name).click()
  await expect(reader.chatModelButton).toContainText(name)
}

test.describe("without a Codex Session", () => {
  test("ChatGPT models explain how to install Codex", async ({ application }) => {
    const reader = new DocumentReaderDriver(application.page)
    await openChatGptModels(reader)

    await expect(application.page.getByRole("menuitemradio")).toHaveCount(0)
    await expect(
      application.page.getByText(/The Codex executable at .*missing-codex could not be run\./),
    ).toBeVisible()
  })

  test("Settings reports the missing Codex and takes an executable override", async ({
    application,
  }) => {
    const reader = new DocumentReaderDriver(application.page)
    await reader.toggleChatPanel("Show")
    await reader.settingsButton.click()
    await reader.aiProviderSettingsButton.click()

    await expect(
      reader.settings.getByText(/The Codex executable at .*missing-codex could not be run\./),
    ).toBeVisible()
    await expect(reader.settings.getByLabel("Codex executable")).toHaveValue(/missing-codex$/)

    const events = await application.page.evaluate(
      () =>
        new Promise((resolve) => {
          window.pdfantom.streamChat(
            {
              id: crypto.randomUUID(),
              conversationId: crypto.randomUUID(),
              source: "chatgpt",
              model: "chatgpt/gpt-5.6-sol",
              messages: [{ id: "m1", role: "user", content: "Hello" }],
            },
            (event) => resolve(event),
          )
        }),
    )

    expect(events).toEqual({
      type: "error",
      message: expect.stringMatching(/could not be run/),
    })
  })
})

test.describe("with an outdated Codex", () => {
  test.use({ fakeCodex: { version: "0.140.0" } })

  test("ChatGPT models ask for an update", async ({ application }) => {
    const reader = new DocumentReaderDriver(application.page)
    await openChatGptModels(reader)

    await expect(
      application.page.getByText("Update the Codex CLI to 0.152.0 or newer (found 0.140.0)."),
    ).toBeVisible()
  })
})

test.describe("with Codex installed but signed out", () => {
  test.use({ fakeCodex: { authMethod: null } })

  test("lists the live catalog but keeps every ChatGPT model unavailable", async ({
    application,
  }) => {
    const reader = new DocumentReaderDriver(application.page)
    await openChatGptModels(reader)

    const option = application.page.getByRole("menuitemradio", { name: "GPT-5.6-Sol" })
    await expect(option).toBeDisabled()
    await expect(option).toContainText(SIGNED_OUT_REASON)
    await expect(reader.chatModelOption("Codex Auto Review")).toHaveCount(0)
  })
})

test.describe("with a Codex Session", () => {
  test.use({
    fakeCodex: {
      replies: ["Osmosis moves water across a membrane", "Because concentrations differ"],
      failingInput: "unavailable model please",
    },
  })

  test("streams ChatGPT replies through one ephemeral Codex Thread per Conversation", async ({
    application,
  }) => {
    const reader = new DocumentReaderDriver(application.page)
    await reader.openFixtureDocument(application, documentFixture)
    await chooseChatGptModel(reader, "GPT-5.6-Sol")
    await reader.chatEffortButton.click()
    await reader.chatEffortOption("Extra high").click()
    await expect(reader.chatEffortButton).toContainText("Extra high")

    await reader.writeChatMessage("What is osmosis?")
    await reader.chatSendMessageButton.click()
    await expect(
      reader.chatThread.getByText("Osmosis moves water across a membrane", { exact: true }),
    ).toBeVisible()

    await reader.writeChatMessage("Why?")
    await reader.chatSendMessageButton.click()
    await expect(
      reader.chatThread.getByText("Because concentrations differ", { exact: true }),
    ).toBeVisible()

    const requests = await readFakeCodexRequests(application.workspace)
    const threadStarts = requests.filter((request) => request.method === "thread/start")
    const turnStarts = requests.filter((request) => request.method === "turn/start")

    expect(requests[0]).toMatchObject({
      method: "initialize",
      params: { clientInfo: { name: "pdfantom" } },
    })
    expect(threadStarts).toHaveLength(1)
    expect(threadStarts[0].params).toMatchObject({
      ephemeral: true,
      model: "gpt-5.6-sol",
      approvalPolicy: "never",
      sandbox: "read-only",
      baseInstructions: expect.stringContaining("PDFantom"),
      config: {
        notify: [],
        web_search: "disabled",
        project_doc_max_bytes: 0,
        features: { shell_tool: false, hooks: false },
        mcp_servers: { playwright: { enabled: false }, docs: { enabled: false } },
      },
    })
    expect(turnStarts.map((request) => request.params)).toEqual([
      expect.objectContaining({
        threadId: "thread-1",
        model: "gpt-5.6-sol",
        effort: "xhigh",
        input: [{ type: "text", text: "What is osmosis?", text_elements: [] }],
      }),
      expect.objectContaining({
        threadId: "thread-1",
        input: [{ type: "text", text: "Why?", text_elements: [] }],
      }),
    ])

    await reader.chatModelButton.click()
    await reader.chatModelSourceTab("OpenRouter models").click()
    await reader.chatModelOption("Free Models Router").click()
    await expect(reader.chatEffortButton).toContainText("Medium")
  })

  test("regenerating rebuilds a fresh Codex Thread from the flattened Conversation", async ({
    application,
  }) => {
    const reader = new DocumentReaderDriver(application.page)
    await reader.openFixtureDocument(application, documentFixture)
    await chooseChatGptModel(reader, "GPT-5.6-Sol")

    await reader.writeChatMessage("What is osmosis?")
    await reader.chatSendMessageButton.click()
    await expect(
      reader.chatThread.getByText("Osmosis moves water across a membrane", { exact: true }),
    ).toBeVisible()
    await reader.writeChatMessage("Why?")
    await reader.chatSendMessageButton.click()
    await expect(
      reader.chatThread.getByText("Because concentrations differ", { exact: true }),
    ).toBeVisible()

    await reader.chatPanel.getByRole("button", { name: "Regenerate response" }).last().click()
    await expect(
      reader.chatThread.getByText("Osmosis moves water across a membrane", { exact: true }),
    ).toHaveCount(2)

    const requests = await readFakeCodexRequests(application.workspace)
    const turnStarts = requests.filter((request) => request.method === "turn/start")

    expect(requests.filter((request) => request.method === "thread/start")).toHaveLength(2)
    expect(turnStarts).toHaveLength(3)
    expect(turnStarts[2].params.threadId).not.toBe(turnStarts[0].params.threadId)
    expect(turnStarts[2].params).toMatchObject({
      input: [
        {
          type: "text",
          text: [
            "The conversation so far, oldest first:",
            "",
            "User:\nWhat is osmosis?",
            "",
            "Assistant:\nOsmosis moves water across a membrane",
            "",
            "The User's new message:\nWhy?",
          ].join("\n"),
        },
      ],
    })
  })

  test("Stop interrupts the Codex turn and retains the partial Assistant Message", async ({
    application,
  }) => {
    const reader = new DocumentReaderDriver(application.page)
    await reader.openFixtureDocument(application, documentFixture)
    await chooseChatGptModel(reader, "GPT-5.6-Sol")

    await reader.writeChatMessage("What is osmosis?")
    await reader.chatSendMessageButton.click()
    await expect(reader.chatThread.getByText(/^Osmosis/)).toBeVisible()
    await reader.chatPanel.getByRole("button", { name: "Stop response" }).click()

    await expect(reader.chatPanel.getByRole("button", { name: "Stop response" })).toBeHidden()
    await expect(reader.chatThread.getByText(/^Osmosis/)).toBeVisible()
    await expect(
      reader.chatPanel.getByRole("button", { name: "Regenerate response" }),
    ).toBeEnabled()
    await expect(
      reader.chatThread.getByText("Unable to generate response. Please try again later."),
    ).toBeHidden()
    await expect
      .poll(async () =>
        (await readFakeCodexRequests(application.workspace)).some(
          (request) => request.method === "turn/interrupt",
        ),
      )
      .toBe(true)
  })

  test("shows the upstream message when Codex reports a failed turn", async ({ application }) => {
    const reader = new DocumentReaderDriver(application.page)
    await reader.openFixtureDocument(application, documentFixture)
    await chooseChatGptModel(reader, "GPT-5.4-Mini")

    await reader.writeChatMessage("Try the unavailable model please")
    await reader.chatSendMessageButton.click()

    await expect(
      reader.chatThread.getByText("This model is not available on your plan.", { exact: true }),
    ).toBeVisible()
  })

  test("Settings shows the signed-in Codex Session", async ({ application }) => {
    const reader = new DocumentReaderDriver(application.page)
    await reader.toggleChatPanel("Show")
    await reader.settingsButton.click()
    await reader.aiProviderSettingsButton.click()

    await expect(reader.settings.getByText("Codex 0.152.0 is signed in and ready")).toBeVisible()
  })
})
