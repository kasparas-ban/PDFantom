import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

test("shows when a message was sent and copies it from the tooltip", async ({ application }) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    globalThis.fetch = async () =>
      new Response('data: {"choices":[{"delta":{"content":"An answer"}}]}\n\ndata: [DONE]\n\n', {
        headers: { "Content-Type": "text/event-stream" },
      })
  })

  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Fix it for me.")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatThread.getByText("An answer", { exact: true })).toBeVisible()

  const hoverMessage = () =>
    expect
      .poll(async () => {
        await reader.chatThread.getByText("Fix it for me.", { exact: true }).hover()
        return reader.chatUserMessageActions.evaluate((bar) => getComputedStyle(bar).opacity)
      })
      .toBe("1")

  await expect(reader.chatUserMessageActions).toHaveCSS("opacity", "0")
  await hoverMessage()
  await expect(reader.chatUserMessageSentTime).not.toBeEmpty()

  await reader.chatCopyMessageButton.hover()
  await expect(reader.tooltip).toHaveText("Copy message")
  await reader.chatCopyMessageButton.click()
  await expect(reader.tooltip).toHaveText("Copied")
  expect(
    await application.electronApplication.evaluate(({ clipboard }) => clipboard.readText()),
  ).toBe("Fix it for me.")

  await reader.chatThread.getByText("An answer", { exact: true }).hover()
  await expect(reader.tooltip).toBeHidden()
  await hoverMessage()
  await expect(reader.tooltip).toBeHidden({ timeout: 500 })
})
