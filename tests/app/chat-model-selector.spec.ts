import path from "node:path"
import { pathToFileURL } from "node:url"

import type { Page } from "@playwright/test"
import { build } from "vite"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

type Boundary = typeof import("../renderer/routing-boundary")
const moduleUrl = pathToFileURL(path.resolve(".vite/reader-tests/routing-boundary.mjs")).href

test.beforeAll(async () => {
  await build({ configFile: path.resolve("tests/renderer/vite.config.ts") })
})

test.beforeEach(async ({ application }) => {
  await mountModelCatalog(application.page)
})

function mountModelCatalog(page: Page) {
  return page.evaluate(async (url) => {
    const { mountRoutes }: Boundary = await import(url)
    const notes = { id: "document-1", name: "notes.pdf", fingerprint: "a".repeat(64) }
    document.getElementById("root")!.style.display = "none"
    const host = document.createElement("div")
    document.body.append(host)

    mountRoutes(
      host,
      {
        // A Document that is present but unavailable: chat works, the reader shows nothing.
        getDocumentLibrary: async () => ({ selectedDocument: notes, documents: [notes] }),
        openDocument: async () => null,
        activateDocument: async () => ({ selectedDocument: notes, documents: [notes] }),
        loadDocument: async () => ({ status: "unavailable", document: notes, reason: "missing" }),
        listChatThreads: async () => [],
        loadChatThread: async () => null,
        createChatThread: async ({ id, documentId, message, selection }) => ({
          id,
          documentId,
          title: message.content,
          createdAt: message.createdAt,
          lastMessageAt: message.createdAt,
          lastViewedAt: message.createdAt,
          selection,
        }),
        appendChatMessage: async ({ threadId, message, selection }) => ({
          id: threadId,
          documentId: "document-1",
          title: "Test thread",
          createdAt: message.createdAt,
          lastMessageAt: message.createdAt,
          lastViewedAt: message.createdAt,
          selection: selection ?? null,
        }),
        deleteChatThread: async () => {},
        markChatThreadViewed: async () => null,
        streamChat: ({ model, effort }, onEvent) => {
          queueMicrotask(() => {
            onEvent({
              type: "delta",
              text: `Response from ${model}${effort ? ` at ${effort} effort` : ""}`,
            })
            onEvent({
              type: "done",
              metadata: { source: "openrouter", model },
            })
          })

          return () => {}
        },
        listModels: async (source) =>
          source === "chatgpt"
            ? {
                models: [
                  { id: "chatgpt/gpt-test", name: "GPT-Test", outputModalities: ["text"] },
                  { id: "chatgpt/gpt-legacy", name: "GPT-Legacy", outputModalities: ["text"] },
                ],
                unavailableReason: "Run `codex login` to use ChatGPT models.",
              }
            : {
                models: [
                  {
                    id: "test/live-model",
                    name: "Live test model",
                    outputModalities: ["text"],
                  },
                  {
                    id: "test/effort-model",
                    name: "Effort test model",
                    effortLevels: ["low", "medium", "high"],
                    outputModalities: ["text"],
                  },
                  {
                    id: "test/music-model",
                    name: "Music test model",
                    outputModalities: ["text", "audio"],
                  },
                ],
              },
        getOpenRouterApiKeyStatus: async () => ({ isConfigured: true }),
        getOpenRouterApiKey: async () => "test-key",
        saveOpenRouterApiKey: async () => {},
        getCodexSettings: async () => ({
          executablePathOverride: null,
          session: { available: false, reason: "Run `codex login` to use ChatGPT models." },
        }),
        saveCodexExecutablePath: async () => {
          throw new Error("Codex settings are read-only in this test")
        },
        getIsFullScreen: async () => false,
        onFullScreenChange: () => () => {},
      },
      ["/"],
    )
  }, moduleUrl)
}

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
    await expect(reader.chatModelSourceTab("OpenRouter models")).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    await expect(option).toHaveAttribute("aria-checked", "true")
    await expect(reader.chatModelFilterInput).toBeFocused()
    await reader.chatModelFilterInput.press("Escape")
    await reader.writeChatMessage("Hello")
    await reader.chatSendMessageButton.click()
    await expect(reader.chatThread.getByText("Response from test/live-model")).toBeVisible()
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

test("ChatGPT models stay unavailable through search and favorites without a Codex Session", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.chatModelButton.click()
  await reader.chatModelSourceTab("ChatGPT models").click()
  const option = application.page.getByRole("menuitemradio", { name: "GPT-Test" })
  await expect(option).toBeDisabled()
  await expect(option).toContainText("Run `codex login` to use ChatGPT models.")
  await expect(application.page.getByRole("menuitemradio", { name: "GPT-Legacy" })).toBeDisabled()

  await reader.chatModelFilterInput.fill("GPT-Test")
  await reader.chatModelFilterInput.press("Meta+1")
  await expect(reader.chatModelButton).toContainText("Free Models Router")
  await application.page.getByRole("button", { name: "Favorite GPT-Test", exact: true }).click()
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
    reader.chatThread.getByText("Response from test/effort-model at high effort"),
  ).toBeVisible()
})

test("selects the last chosen Model and effort on the next launch", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.chatModelButton.click()
  await reader.chatModelFilterInput.fill("Effort test model")
  await reader.chatModelOption("Effort test model").click()
  await reader.chatEffortButton.click()
  await reader.chatEffortOption("High").click()
  await expect(reader.chatEffortButton).toContainText("High")

  const restarted = await application.relaunch()
  await mountModelCatalog(restarted.page)

  const restored = new DocumentReaderDriver(restarted.page)
  await expect(restored.chatModelButton).toContainText("Effort test model")
  await expect(restored.chatEffortButton).toContainText("High")
})
