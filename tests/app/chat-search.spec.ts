import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { installEchoingOpenRouter } from "./echoing-openrouter"
import type { launchTestApplication } from "./launch-application"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

type Application = Awaited<ReturnType<typeof launchTestApplication>>

async function installResponse(application: Application, assistantMessage: string) {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate((_electron, streamedAssistantMessage) => {
    globalThis.fetch = async () =>
      new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: streamedAssistantMessage } }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      )
  }, assistantMessage)
}

async function sendMain(reader: DocumentReaderDriver, text: string, assistantMessage: string) {
  await reader.writeChatMessage(text)
  await reader.chatSendMessageButton.click()
  await expect(reader.chatThread.getByText(assistantMessage, { exact: true }).first()).toBeVisible()
}

async function highlightIsRegistered(application: Application, name: string) {
  return application.page.evaluate((highlightName) => CSS.highlights.has(highlightName), name)
}

async function currentHighlightIsVisible(application: Application, mode: "main" | "side") {
  return application.page.evaluate((panelMode) => {
    const range = CSS.highlights
      .get(`pdfantom-chat-search-${panelMode}-current`)
      ?.values()
      .next().value
    if (!(range instanceof Range)) return false

    const panel = document.querySelector(panelMode === "main" ? "#chat-panel" : "#side-chat-panel")
    const viewport = panel?.querySelector<HTMLElement>("[data-slot='chat-viewport']")
    const search = panel?.querySelector<HTMLElement>("[data-slot='chat-search']")
    if (!viewport || !search) return false

    const matchBounds = range.getBoundingClientRect()
    const viewportBounds = viewport.getBoundingClientRect()
    const searchBounds = search.getBoundingClientRect()
    const visibleTop = Math.max(viewportBounds.top, searchBounds.bottom)

    return matchBounds.top >= visibleTop && matchBounds.bottom <= viewportBounds.bottom
  }, mode)
}

test("searches rendered chat text with shared controls and preserves panel lifetime", async ({
  application,
}) => {
  const assistantMessage = [
    "## Searchable content",
    "",
    "A **Café entry** crosses formatting.",
    "",
    "Inline math: $x+1$.",
    "",
    "```python",
    'serve("Café")',
    "```",
  ].join("\n")
  await installResponse(application, assistantMessage)
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await sendMain(reader, "Tell me about CAFÉ", "Searchable content")

  await reader.openChatSearch()
  await expect(reader.chatSearchInput).toBeFocused()
  await reader.chatSearchInput.fill("cafe")
  await expect(reader.chatSearchCount).toHaveText("1 / 3")
  await expect
    .poll(() => highlightIsRegistered(application, "pdfantom-chat-search-main"))
    .toBe(true)
  await expect
    .poll(() => highlightIsRegistered(application, "pdfantom-chat-search-main-current"))
    .toBe(true)

  await reader.chatSearchInput.press("Enter")
  await expect(reader.chatSearchCount).toHaveText("2 / 3")
  await reader.chatSearchInput.press("Shift+Enter")
  await expect(reader.chatSearchCount).toHaveText("1 / 3")
  await reader.chatSearchPreviousButton.click()
  await expect(reader.chatSearchCount).toHaveText("3 / 3")
  await expect(reader.chatSearch.getByText("Search wrapped")).toBeAttached()
  await reader.chatSearchNextButton.click()
  await expect(reader.chatSearchCount).toHaveText("1 / 3")

  await reader.chatSearchInput.fill("cafe entry")
  await expect(reader.chatSearchCount).toHaveText("1 / 1")
  await reader.chatSearchInput.fill("serve")
  await expect(reader.chatSearchCount).toHaveText("1 / 1")
  await reader.chatSearchInput.fill("python")
  await expect(reader.chatSearchCount).toHaveText("0 / 0")
  await expect(reader.chatSearch.getByText("No matches")).toBeAttached()
  await reader.chatSearchInput.fill("x+1")
  await expect(reader.chatSearchCount).toHaveText("1 / 1")
  await expect.poll(() => currentHighlightIsVisible(application, "main")).toBe(true)

  await reader.chatSearchInput.fill("cafe")
  await reader.chatSearchCloseButton.click()
  await expect(reader.chatSearch).toHaveCount(0)
  await expect(reader.chatMessageInput).toBeFocused()
  await reader.openChatSearch()
  await expect(reader.chatSearchInput).toHaveValue("cafe")
  await expect(reader.chatSearchCount).toHaveText("1 / 3")

  await reader.toggleChatPanel("Hide")
  await expect(reader.chatPanel).toBeHidden()
  await reader.toggleChatPanel("Show")
  await expect(reader.chatSearchInput).toHaveValue("cafe")

  await reader.chatPanelResizeHandle.press("Home")
  await expect.poll(() => reader.chatPanelWidth()).toBe(200)
  await expect
    .poll(async () => {
      const [input, count, button, search] = await Promise.all([
        reader.chatSearchInput.boundingBox(),
        reader.chatSearchCount.boundingBox(),
        reader.chatSearchPreviousButton.boundingBox(),
        reader.chatSearch.boundingBox(),
      ])

      return Boolean(
        input &&
        count &&
        button &&
        search &&
        count.y > input.y &&
        Math.abs(count.y + count.height / 2 - (button.y + button.height / 2)) < 1 &&
        search.height > 48,
      )
    })
    .toBe(true)
})

test("keeps main and Side Chat searches independent and focus-scoped", async ({ application }) => {
  await installEchoingOpenRouter(application)
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await sendMain(reader, "Main alpha", "Reply to Main alpha")

  await reader.selectChatMessageText("Reply to Main alpha")
  await reader.chatAskInSideChatButton.click()
  await reader.sideChatMessageInput.fill("Side beta")
  await reader.sideChatSendMessageButton.click()
  await expect(reader.sideChatThread.getByText("Reply to Side beta", { exact: true })).toBeVisible()

  await reader.chatMessageText("Reply to Main alpha").click()
  await application.page.keyboard.press("Meta+f")
  await expect(reader.chatSearchInput).toBeFocused()
  await reader.chatSearchInput.fill("main")
  await expect(reader.chatSearchCount).toHaveText("1 / 2")

  await reader.sideChatMessageText("Reply to Side beta").click()
  await application.page.keyboard.press("Meta+f")
  await expect(reader.sideChatSearchInput).toBeFocused()
  await reader.sideChatSearchInput.fill("beta")
  await expect(reader.sideChatSearchCount).toHaveText("1 / 2")
  await expect(reader.chatSearchInput).toHaveValue("main")
  await expect
    .poll(() => highlightIsRegistered(application, "pdfantom-chat-search-main"))
    .toBe(true)
  await expect
    .poll(() => highlightIsRegistered(application, "pdfantom-chat-search-side"))
    .toBe(true)

  await application.page.keyboard.press("Meta+f")
  await expect
    .poll(() =>
      reader.sideChatSearchInput.evaluate(
        (input) =>
          input instanceof HTMLInputElement &&
          input.selectionStart === 0 &&
          input.selectionEnd === input.value.length,
      ),
    )
    .toBe(true)

  await reader.sideChatSearchCloseButton.click()
  await expect(reader.sideChatMessageInput).toBeFocused()
  await expect(reader.chatSearchInput).toHaveValue("main")
})

test("refreshes Search Matches while an Assistant Message streams", async ({ application }) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    const encoder = new TextEncoder()

    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            Reflect.set(globalThis, "chatSearchStream", { controller, encoder })
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      )
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Start streaming")
  await reader.chatSendMessageButton.click()
  await expect
    .poll(() =>
      application.electronApplication.evaluate(() =>
        Boolean(Reflect.get(globalThis, "chatSearchStream")),
      ),
    )
    .toBe(true)

  await reader.openChatSearch()
  await reader.chatSearchInput.fill("needle")
  await expect(reader.chatSearchCount).toHaveText("0 / 0")

  await application.electronApplication.evaluate(() => {
    const stream = Reflect.get(globalThis, "chatSearchStream")
    stream.controller.enqueue(
      stream.encoder.encode('data: {"choices":[{"delta":{"content":"needle"}}]}\n\n'),
    )
  })
  await expect(reader.chatSearchCount).toHaveText("1 / 1")

  await application.electronApplication.evaluate(() => {
    const stream = Reflect.get(globalThis, "chatSearchStream")
    stream.controller.enqueue(
      stream.encoder.encode('data: {"choices":[{"delta":{"content":" and needle"}}]}\n\n'),
    )
    stream.controller.enqueue(stream.encoder.encode("data: [DONE]\n\n"))
    stream.controller.close()
  })
  await expect(reader.chatSearchCount).toHaveText("1 / 2")
})

test("expands a Quote for the current exact match and collapses it when navigation moves", async ({
  application,
}) => {
  const assistantMessage =
    "This deliberately long Quote contains enough words to wrap across several lines in the chat panel before reaching the unique finaltoken."
  await installResponse(application, assistantMessage)
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await sendMain(reader, "Make a long quote", assistantMessage)

  await reader.chatMessageText(assistantMessage).selectText()
  await reader.chatViewport.dispatchEvent("mouseup")
  await expect(reader.chatSelectionToolbar).toBeVisible()
  await reader.chatAddToChatButton.click()
  await reader.writeChatMessage("Use this Quote")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatMessageText(assistantMessage)).toHaveCount(2)

  const quote = reader.chatUserMessageQuoteTexts.locator("..")
  const collapsedHeight = await quote.evaluate((element) => element.getBoundingClientRect().height)
  await reader.openChatSearch()
  await reader.chatSearchInput.fill("finaltoken")
  await expect(reader.chatSearchCount).toHaveText("1 / 3")

  await reader.chatSearchInput.press("Enter")
  await expect(reader.chatSearchCount).toHaveText("2 / 3")
  await expect(quote).toHaveAttribute("data-chat-search-current", "true")
  await expect
    .poll(() => quote.evaluate((element) => element.getBoundingClientRect().height))
    .toBeGreaterThan(collapsedHeight)
  await expect.poll(() => currentHighlightIsVisible(application, "main")).toBe(true)

  await reader.chatSearchInput.press("Enter")
  await expect(reader.chatSearchCount).toHaveText("3 / 3")
  await expect(quote).not.toHaveAttribute("data-chat-search-current")
  await expect
    .poll(() => quote.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(collapsedHeight)
  await expect.poll(() => currentHighlightIsVisible(application, "main")).toBe(true)
})

test("ends Chat Search when the shown Chat Thread switches or is deleted", async ({
  application,
}) => {
  await installEchoingOpenRouter(application)
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await sendMain(reader, "First target", "Reply to First target")

  await reader.openChatSearch()
  await reader.chatSearchInput.fill("first")
  await expect(reader.chatSearchCount).toHaveText("1 / 2")
  await reader.newChatThreadFromPanelButton.click()
  await expect(reader.chatSearch).toHaveCount(0)
  await reader.openChatSearch()
  await expect(reader.chatSearchInput).toHaveValue("")
  await reader.chatSearchCloseButton.click()

  await sendMain(reader, "Second target", "Reply to Second target")
  await reader.chatThreadEntry("First target").click()
  await reader.openChatSearch()
  await reader.chatSearchInput.fill("first")
  await expect(reader.chatSearchCount).toHaveText("1 / 2")

  await reader.chatThreadEntry("First target").hover()
  await reader.chatThreadActionsButton("First target").click()
  await application.page.getByRole("menuitem", { name: "Delete" }).click()
  await application.page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(reader.chatSearch).toHaveCount(0)
  await expect(reader.chatPanelTitle).toHaveText("New chat")
})
