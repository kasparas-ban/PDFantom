import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import type { launchTestApplication } from "./launch-application"
import { expect, test } from "./test"

type Application = Awaited<ReturnType<typeof launchTestApplication>>

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

async function openChatWithAnswer(application: Application) {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async (_input, init) => {
      if (typeof init?.body === "string") {
        Reflect.set(globalThis, "chatRequestBody", JSON.parse(init.body))
      }

      return new Response(
        'data: {"choices":[{"delta":{"content":"Confirm keepalives at 20, 40, and 60 seconds."}}]}\n\ndata: [DONE]\n\n',
        { headers: { "Content-Type": "text/event-stream" } },
      )
    }
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("What did the tests confirm?")
  await reader.chatSendMessageButton.click()
  await expect(
    reader.chatThread.getByText("Confirm keepalives at 20, 40, and 60 seconds.", { exact: true }),
  ).toBeVisible()

  return reader
}

test("shows a toolbar above selected message text and adds the selection as a Quote", async ({
  application,
}) => {
  const reader = await openChatWithAnswer(application)

  await expect(reader.chatSelectionToolbar).toBeHidden()
  await reader.selectChatMessageText("Confirm keepalives at 20, 40, and 60 seconds.")
  await expect(reader.chatSelectionToolbar).toBeVisible()

  const toolbar = await reader.chatSelectionToolbar.boundingBox()
  const panel = await reader.chatPanel.boundingBox()
  const selected = await reader
    .chatMessageText("Confirm keepalives at 20, 40, and 60 seconds.")
    .boundingBox()
  expect(toolbar!.x).toBeGreaterThanOrEqual(panel!.x)
  expect(toolbar!.x + toolbar!.width).toBeLessThanOrEqual(panel!.x + panel!.width)
  expect(toolbar!.y + toolbar!.height).toBeLessThanOrEqual(selected!.y)

  await expect(reader.chatAskInSideChatButton).toBeEnabled()

  await reader.chatAddToChatButton.click()
  await expect(reader.chatSelectionToolbar).toBeHidden()
  expect(await reader.selectedText()).toBe("")
  await expect(reader.chatMessageInput).toBeFocused()
  await expect(reader.chatComposerQuoteTexts).toHaveText([
    "Confirm keepalives at 20, 40, and 60 seconds.",
  ])

  await reader.selectChatMessageText("Confirm keepalives at 20, 40, and 60 seconds.")
  await reader.chatAddToChatButton.click()
  await expect(reader.chatComposerQuotes).toHaveCount(1)

  await reader.selectChatMessageText("What did the tests confirm?")
  await reader.chatAddToChatButton.click()
  await expect(reader.chatComposerQuoteTexts).toHaveText([
    "Confirm keepalives at 20, 40, and 60 seconds.",
    "What did the tests confirm?",
  ])

  await reader.chatComposerQuotes.nth(1).getByRole("button", { name: "Remove quote" }).click()
  await expect(reader.chatComposerQuotes).toHaveCount(1)

  await reader.writeChatMessage("Why 20?")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatMessageText("Why 20?")).toBeVisible()
  await expect(reader.chatComposerQuotes).toHaveCount(0)
  await expect(reader.chatUserMessageQuoteTexts).toHaveText([
    "Confirm keepalives at 20, 40, and 60 seconds.",
  ])
  await expect
    .poll(() =>
      application.electronApplication.evaluate(() => Reflect.get(globalThis, "chatRequestBody")),
    )
    .toMatchObject({
      messages: [
        { role: "user", content: "What did the tests confirm?" },
        { role: "assistant", content: "Confirm keepalives at 20, 40, and 60 seconds." },
        {
          role: "user",
          content:
            "Quoting from the conversation:\n> Confirm keepalives at 20, 40, and 60 seconds.\n\nWhy 20?",
        },
      ],
    })

  const restarted = await application.relaunch()
  const restored = new DocumentReaderDriver(restarted.page)
  await expect(restored.chatMessageText("Why 20?")).toBeVisible()
  await expect(restored.chatUserMessageQuoteTexts).toHaveText([
    "Confirm keepalives at 20, 40, and 60 seconds.",
  ])
  await restored.chatUserMessageQuoteTexts.hover()
  await expect(restored.tooltip).toHaveText("Confirm keepalives at 20, 40, and 60 seconds.")
})

test("sends a Quote on its own and ignores selections that leave a message", async ({
  application,
}) => {
  const reader = await openChatWithAnswer(application)

  await reader.selectChatMessageText("Confirm keepalives at 20, 40, and 60 seconds.")
  await reader.chatAddToChatButton.click()
  await expect(reader.chatSendMessageButton).toBeEnabled()
  await reader.chatSendMessageButton.click()
  await expect(reader.chatMessageText("Confirm keepalives at 20, 40, and 60 seconds.")).toHaveCount(
    2,
  )
  await expect(reader.chatUserMessageQuoteTexts).toHaveText([
    "Confirm keepalives at 20, 40, and 60 seconds.",
  ])
  await expect
    .poll(() =>
      application.electronApplication.evaluate(() => Reflect.get(globalThis, "chatRequestBody")),
    )
    .toMatchObject({
      messages: [
        { role: "user", content: "What did the tests confirm?" },
        { role: "assistant", content: "Confirm keepalives at 20, 40, and 60 seconds." },
        {
          role: "user",
          content:
            "Quoting from the conversation:\n> Confirm keepalives at 20, 40, and 60 seconds.",
        },
      ],
    })

  await application.page.evaluate(() => {
    const messages = document.querySelectorAll("[data-slot='chat-thread'] [data-message-id]")
    const range = document.createRange()
    range.setStartBefore(messages[0])
    range.setEndAfter(messages[1])
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    document
      .querySelector("[data-slot='chat-viewport']")!
      .dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
  })
  await expect(reader.chatSelectionToolbar).toBeHidden({ timeout: 1000 })

  await reader.selectChatMessageText("What did the tests confirm?")
  await expect(reader.chatSelectionToolbar).toBeVisible()
  await application.page.keyboard.press("Escape")
  await expect(reader.chatSelectionToolbar).toBeHidden()
})

test("follows the chat scroll, hides when the selection leaves the panel, and never quotes a Quote", async ({
  application,
}) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    const paragraphs = Array.from(
      { length: 30 },
      (_, index) => `Paragraph ${index + 1} of the long reply.`,
    )
    const payload = JSON.stringify({ choices: [{ delta: { content: paragraphs.join("\n\n") } }] })

    globalThis.fetch = async () =>
      new Response(`data: ${payload}\n\ndata: [DONE]\n\n`, {
        headers: { "Content-Type": "text/event-stream" },
      })
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Tell me everything.")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatMessageText("Paragraph 30 of the long reply.")).toBeVisible()
  await reader.scrollChatMessageTextIntoView("Paragraph 30 of the long reply.")
  await reader.selectChatMessageText("Paragraph 30 of the long reply.")
  await expect(reader.chatSelectionToolbar).toBeVisible()
  const before = (await reader.chatSelectionToolbar.boundingBox())!

  await reader.chatViewport.evaluate((viewport) =>
    viewport.scrollTo({ top: viewport.scrollTop - 120, behavior: "instant" }),
  )
  await expect
    .poll(async () => (await reader.chatSelectionToolbar.boundingBox())?.y)
    .toBeCloseTo(before.y + 120, 0)

  await reader.chatViewport.evaluate((viewport) =>
    viewport.scrollTo({ top: 0, behavior: "instant" }),
  )
  await expect(reader.chatSelectionToolbar).toBeHidden()
  expect(await reader.selectedText()).toBe("Paragraph 30 of the long reply.")

  await reader.chatViewport.evaluate((viewport) =>
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "instant" }),
  )
  await expect(reader.chatSelectionToolbar).toBeVisible()
  await reader.chatMessageInput.click()
  await expect(reader.chatSelectionToolbar).toBeHidden()

  await reader.scrollChatMessageTextIntoView("Paragraph 1 of the long reply.")
  await reader.selectChatMessageText("Paragraph 1 of the long reply.")
  await reader.chatAddToChatButton.click()
  await reader.writeChatMessage("Why start there?")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatUserMessageQuoteTexts).toHaveText(["Paragraph 1 of the long reply."])
  await reader.scrollChatMessageTextIntoView("Why start there?")

  const strip = (await reader.chatUserMessageQuoteTexts.boundingBox())!
  await application.page.evaluate(() => window.getSelection()?.removeAllRanges())
  await application.page.mouse.move(strip.x + 1, strip.y + strip.height / 2)
  await application.page.mouse.down()
  await application.page.mouse.move(strip.x + strip.width - 1, strip.y + strip.height / 2, {
    steps: 4,
  })
  await application.page.mouse.up()
  expect(await reader.selectedText()).toContain("Paragraph 1")
  await expect(reader.chatSelectionToolbar).toBeHidden({ timeout: 1000 })

  await reader.selectChatMessageText("Why start there?")
  await expect(reader.chatSelectionToolbar).toBeVisible()
})
