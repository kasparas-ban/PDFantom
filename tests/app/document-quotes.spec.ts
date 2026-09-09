import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import type { launchTestApplication } from "./launch-application"
import { expect, test } from "./test"

type Application = Awaited<ReturnType<typeof launchTestApplication>>

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

async function openDocumentWithModel(application: Application) {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async (_input, init) => {
      if (typeof init?.body === "string") {
        Reflect.set(globalThis, "chatRequestBody", JSON.parse(init.body))
      }

      return new Response(
        'data: {"choices":[{"delta":{"content":"It introduces ecosystems."}}]}\n\ndata: [DONE]\n\n',
        { headers: { "Content-Type": "text/event-stream" } },
      )
    }
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)

  return reader
}

test("adds a Document selection as a Quote with its page and opens the chat panel", async ({
  application,
}) => {
  const reader = await openDocumentWithModel(application)
  await expect(reader.chatPanel).toBeHidden()
  await expect(reader.documentSelectionToolbar).toBeHidden()

  await reader.selectDocumentText({ page: 1, text: "Introduction to" })
  await expect(reader.documentSelectionToolbar).toBeVisible()

  const toolbar = (await reader.documentSelectionToolbar.boundingBox())!
  const bounds = (await reader.presentedReader.boundingBox())!
  const selected = (await reader.presentedReader
    .getByText("Introduction to", { exact: true })
    .boundingBox())!
  expect(toolbar.x).toBeGreaterThanOrEqual(bounds.x)
  expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(bounds.x + bounds.width)
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(selected.y)

  await reader.documentAddToChatButton.click()
  await expect(reader.chatPanel).toBeVisible()
  await expect(reader.documentSelectionToolbar).toBeHidden()
  expect(await reader.selectedText()).toBe("")
  await expect(reader.chatMessageInput).toBeFocused()
  await expect(reader.chatComposerQuoteTexts).toHaveText(["Introduction to"])
  await expect(reader.chatComposerQuotePages).toHaveText(["p. 1"])

  await reader.selectDocumentText({ page: 1, text: "Introduction to" })
  await reader.documentAddToChatButton.click()
  await expect(reader.chatComposerQuotes).toHaveCount(1)

  await reader.writeChatMessage("What is this about?")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatMessageText("What is this about?")).toBeVisible()
  await expect(reader.chatComposerQuotes).toHaveCount(0)
  await expect(reader.chatUserMessageQuoteTexts).toHaveText(["Introduction to"])
  await expect(reader.chatUserMessageQuotePages).toHaveText(["p. 1"])
  await expect
    .poll(() =>
      application.electronApplication.evaluate(() => Reflect.get(globalThis, "chatRequestBody")),
    )
    .toMatchObject({
      messages: [
        {
          role: "user",
          content: "Quoting from the document, page 1:\n> Introduction to\n\nWhat is this about?",
        },
      ],
    })

  const restarted = await application.relaunch()
  const restored = new DocumentReaderDriver(restarted.page)
  await expect(restored.chatMessageText("What is this about?")).toBeVisible()
  await expect(restored.chatUserMessageQuoteTexts).toHaveText(["Introduction to"])
  await expect(restored.chatUserMessageQuotePages).toHaveText(["p. 1"])
})

test("quotes across pages as one Quote, dismisses with Escape, and ignores selections outside the text", async ({
  application,
}) => {
  const reader = await openDocumentWithModel(application)
  await reader.toggleChatPanel("Show")
  await reader.goToPage(2)
  await reader.goToPage(1)

  await reader.selectDocumentText(
    { page: 1, text: "STUDENT EDITION | SAMPLE DOCUMENT FIXTURE" },
    { page: 2, text: "INTRODUCTION TO ECOSYSTEMS" },
  )
  await expect(reader.documentSelectionToolbar).toBeVisible()
  await reader.documentAddToChatButton.click()
  await expect(reader.chatComposerQuoteTexts).toHaveText([
    "STUDENT EDITION | SAMPLE DOCUMENT FIXTURE INTRODUCTION TO ECOSYSTEMS",
  ])
  await expect(reader.chatComposerQuotePages).toHaveText(["pp. 1–2"])

  await reader.selectDocumentText({ page: 1, text: "Introduction to" })
  await expect(reader.documentSelectionToolbar).toBeVisible()
  await application.page.keyboard.press("Escape")
  await expect(reader.documentSelectionToolbar).toBeHidden()
  expect(await reader.selectedText()).toBe("Introduction to")

  await application.page.evaluate(() => {
    const viewer = document.querySelector('[data-presented="true"] .pdfViewer')!
    const range = document.createRange()
    range.selectNodeContents(viewer)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    viewer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
  })
  await expect(reader.documentSelectionToolbar).toBeHidden({ timeout: 1000 })
  await expect(reader.chatSelectionToolbar).toBeHidden()
})
