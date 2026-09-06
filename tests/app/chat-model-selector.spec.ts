import path from "node:path"
import { pathToFileURL } from "node:url"

import { build } from "vite"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

type Boundary = typeof import("../renderer/routing-boundary")
const moduleUrl = pathToFileURL(path.resolve(".vite/reader-tests/routing-boundary.mjs")).href

test.beforeAll(async () => {
  await build({ configFile: path.resolve("tests/renderer/vite.config.ts") })
})

test.beforeEach(async ({ application }) => {
  await application.page.evaluate(async (url) => {
    const { mountRoutes }: Boundary = await import(url)
    document.getElementById("root")!.style.display = "none"
    const host = document.createElement("div")
    document.body.append(host)

    mountRoutes(
      host,
      {
        getDocumentLibrary: async () => ({ selectedDocument: null, documents: [] }),
        openDocument: async () => null,
        activateDocument: async () => ({ selectedDocument: null, documents: [] }),
        loadDocument: async () => {
          throw new Error("No documents")
        },
        streamChat: ({ model, effort }, onEvent) => {
          queueMicrotask(() => {
            onEvent({
              type: "delta",
              text: `Response from ${model}${effort ? ` at ${effort} effort` : ""}`,
            })
            onEvent({
              type: "done",
              metadata: { provider: "openrouter", model },
            })
          })

          return () => {}
        },
        listProviderModels: async () => ({
          models: [
            {
              id: "test/live-model",
              name: "Live test model",
              outputModalities: ["text"],
            },
            {
              id: "test/effort-model",
              name: "Effort test model",
              supportsEffort: true,
              outputModalities: ["text"],
            },
            {
              id: "test/music-model",
              name: "Music test model",
              outputModalities: ["text", "audio"],
            },
          ],
        }),
        getOpenRouterApiKeyStatus: async () => ({ isConfigured: true }),
        getOpenRouterApiKey: async () => "test-key",
        saveOpenRouterApiKey: async () => {},
        getIsFullScreen: async () => false,
        onFullScreenChange: () => () => {},
      },
      ["/"],
    )
  }, moduleUrl)
})

for (const interaction of ["click", "arrows", "shortcut"] as const) {
  test(`selects and sends a live-only model using ${interaction}`, async ({ application }) => {
    const reader = new DocumentReaderDriver(application.page)
    await reader.toggleChatPanel("Show")
    await reader.chatModelButton.click()
    await expect(reader.chatModelFilterInput).toBeFocused()
    await reader.chatModelFilterInput.fill("Live test model")
    const option = reader.chatModelOption("Live test model")
    await expect(option).toBeVisible()

    if (interaction === "click") {
      await option.click()
    } else if (interaction === "arrows") {
      await reader.chatModelFilterInput.press("ArrowDown")
      await expect(option).toBeFocused()
      await option.press("Enter")
    } else {
      await reader.chatModelFilterInput.press("Meta+1")
      await reader.chatModelFilterInput.press("Escape")
    }

    await expect(reader.chatModelButton).toContainText("Live test model")
    await reader.chatModelButton.click()
    await expect(
      application.page.getByRole("button", { name: "OpenRouter models" }),
    ).toHaveAttribute("aria-pressed", "true")
    await expect(option).toHaveAttribute("aria-checked", "true")
    await reader.chatModelFilterInput.press("Escape")
    await reader.writeChatMessage("Hello")
    await reader.chatSendMessageButton.click()
    await expect(reader.chatPanel.getByText("Response from test/live-model")).toBeVisible()
  })
}

test("hides models that produce text alongside another output modality", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.chatModelButton.click()
  await reader.chatModelFilterInput.fill("Music test model")

  await expect(reader.chatModelOption("Music test model")).toHaveCount(0)
})

test("ChatGPT models stay unavailable through search, legacy groups and favorites", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.chatModelButton.click()
  await application.page.getByRole("button", { name: "ChatGPT models", exact: true }).click()
  const option = application.page.getByRole("menuitemradio", { name: "GPT-6-Astra" })
  await expect(option).toBeDisabled()
  await expect(option).toContainText("ChatGPT support is not available yet")
  await application.page.getByRole("button", { name: "Legacy models" }).click()
  await expect(application.page.getByRole("menuitemradio", { name: "GPT-5.5" })).toBeDisabled()

  await reader.chatModelFilterInput.fill("Astra")
  await reader.chatModelFilterInput.press("Meta+1")
  await expect(reader.chatModelButton).toContainText("Free Models Router")
  await application.page.getByRole("button", { name: "Favorite GPT-6-Astra", exact: true }).click()
  await application.page.getByRole("button", { name: "Favorite models", exact: true }).click()
  await expect(option).toBeDisabled()
  await reader.chatModelFilterInput.fill("")
  await reader.chatModelFilterInput.press("Control+1")
  await reader.chatModelFilterInput.press("Escape")
  await expect(reader.chatModelButton).toContainText("Free Models Router")

  await reader.chatModelButton.click()
  await reader.chatModelFilterInput.fill("Live test model")
  await application.page
    .getByRole("button", { name: "Favorite Live test model", exact: true })
    .click()
  await application.page.getByRole("button", { name: "Favorite models", exact: true }).click()
  await reader.chatModelFilterInput.fill("")
  await expect(option).toBeDisabled()
  await expect(reader.chatModelOption("Live test model")).toBeEnabled()
  await reader.chatModelFilterInput.press("Control+1")
  await reader.chatModelFilterInput.press("Escape")
  await expect(reader.chatModelButton).toContainText("Live test model")
})

test("chooses a reasoning effort only for models that support it", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await expect(reader.chatEffortButton).toContainText("Medium")

  await reader.chatModelButton.click()
  await reader.chatModelFilterInput.fill("Live test model")
  await reader.chatModelOption("Live test model").click()
  await expect(reader.chatEffortButton).toBeHidden()

  await reader.chatModelButton.click()
  await reader.chatModelFilterInput.fill("Effort test model")
  await reader.chatModelOption("Effort test model").click()
  await expect(reader.chatEffortButton).toBeVisible()

  await reader.chatEffortButton.click()
  await reader.chatEffortOption("High").click()
  await expect(reader.chatEffortButton).toContainText("High")

  await reader.writeChatMessage("Hello")
  await reader.chatSendMessageButton.click()
  await expect(
    reader.chatPanel.getByText("Response from test/effort-model at high effort"),
  ).toBeVisible()
})
