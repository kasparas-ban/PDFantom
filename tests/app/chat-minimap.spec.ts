import type { ElectronApplication } from "@playwright/test"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

const WIDE_PANEL_DELTA = 600

/** Enough of a reply that a single turn overflows the Conversation viewport. */
const stubLongReplies = (electronApplication: ElectronApplication) =>
  electronApplication.evaluate(() => {
    const paragraph = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(120)
    const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: paragraph } }] })}\n\n`

    globalThis.fetch = async () =>
      new Response(`${chunk}data: [DONE]\n\n`, {
        headers: { "Content-Type": "text/event-stream" },
      })
  })

async function ask(reader: DocumentReaderDriver, question: string) {
  await reader.writeChatMessage(question)
  await reader.chatSendMessageButton.click()
  await expect(reader.chatPanel.getByText(question, { exact: true })).toBeVisible()
  await expect(reader.chatStopResponseButton).toBeHidden()
}

test("maps every turn of the Conversation onto the minimap", async ({ application }) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await stubLongReplies(application.electronApplication)

  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.toggleDocumentsPanel("Hide")
  await reader.resizeChatPanelBy(WIDE_PANEL_DELTA)

  await ask(reader, "What does the first section argue?")
  await expect(reader.chatMinimap).toBeHidden()

  await ask(reader, "And the second section?")
  await expect(reader.chatMinimapDashes).toHaveCount(2)

  await reader.hoverChatMinimapAt(0)
  await expect(reader.chatMinimapPreview).toContainText("What does the first section argue?")
  await expect(reader.chatMinimapPreview).toContainText("Lorem ipsum")

  await reader.hoverChatMinimapAt(1)
  await expect(reader.chatMinimapPreview).toContainText("And the second section?")

  expect(await reader.chatViewportScrollTop()).toBeGreaterThan(0)
  await expect.poll(() => reader.chatMinimapDashesInView()).toEqual([false, true])

  await reader.clickChatMinimapAt(0)
  await expect.poll(() => reader.chatViewportScrollTop()).toBeLessThan(40)
  await expect.poll(() => reader.chatMinimapDashesInView()).toEqual([true, false])

  const [onScreen, offScreen] = await reader.chatMinimapDashColours()
  expect(onScreen).not.toBe(offScreen)
})

test("holds the minimap back until a narrow panel is pointed at", async ({ application }) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await stubLongReplies(application.electronApplication)

  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")

  await ask(reader, "What does the first section argue?")
  await ask(reader, "And the second section?")

  await expect(reader.chatMinimap).toHaveCSS("opacity", "0")
  await reader.hoverChatMinimapAt(0)
  await expect(reader.chatMinimap).toHaveCSS("opacity", "1")

  await reader.toggleDocumentsPanel("Hide")
  await reader.resizeChatPanelBy(WIDE_PANEL_DELTA)
  await reader.chatMessageInput.hover()
  await expect(reader.chatMinimap).toHaveCSS("opacity", "1")
})
