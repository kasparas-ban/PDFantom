import path from "node:path"

import { SIDE_CHAT_INSTRUCTION } from "../../src/main/side-chat-context"
import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import type { launchTestApplication } from "./launch-application"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

type Application = Awaited<ReturnType<typeof launchTestApplication>>

type RequestBody = { model: string; messages: { role: string; content: unknown }[] }

async function installEchoingOpenRouter(application: Application) {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    const bodies: { model: string; messages: { role: string; content: unknown }[] }[] = []
    Reflect.set(globalThis, "chatBodies", bodies)

    globalThis.fetch = async (_input, init) => {
      if (typeof init?.body !== "string") throw new Error("Expected a JSON request body")

      const body = JSON.parse(init.body)
      bodies.push(body)
      const content: string = body.messages.at(-1).content
      const prompt = content.split("\n").at(-1)

      return new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Reply to ${prompt}` } }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      )
    }
  })

  return () =>
    application.electronApplication.evaluate(() => {
      const bodies: RequestBody[] = Reflect.get(globalThis, "chatBodies")

      return bodies
    })
}

async function sendMain(reader: DocumentReaderDriver, text: string) {
  await reader.writeChatMessage(text)
  await reader.chatSendMessageButton.click()
  await expect(reader.chatThread.getByText(`Reply to ${text}`, { exact: true })).toBeVisible()
}

async function sendSide(reader: DocumentReaderDriver, text: string) {
  await reader.sideChatMessageInput.fill(text)
  await reader.sideChatSendMessageButton.click()
  await expect(reader.sideChatThread.getByText(`Reply to ${text}`, { exact: true })).toBeVisible()
}

async function openChatWithReply(application: Application, question: string) {
  const requestBodies = await installEchoingOpenRouter(application)
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await sendMain(reader, question)

  return { reader, requestBodies }
}

test("Ask in side chat quotes the selection into a Side Chat that sees the live parent transcript", async ({
  application,
}) => {
  const { reader, requestBodies } = await openChatWithReply(application, "Main question")
  await expect(reader.sideChatPanel).toBeHidden()

  await reader.selectChatMessageText("Reply to Main question")
  await reader.chatAskInSideChatButton.click()

  await expect(reader.sideChatPanel).toBeVisible()
  await expect(reader.sideChatTab("Side chat")).toHaveAttribute("aria-selected", "true")
  await expect(reader.sideChatEmptyState).toBeVisible()
  await expect(reader.sideChatComposerQuoteTexts).toHaveText(["Reply to Main question"])
  await expect(reader.sideChatMessageInput).toBeFocused()
  expect(await reader.selectedText()).toBe("")

  await reader.selectChatMessageText("Reply to Main question")
  await reader.chatAskInSideChatButton.click()
  await expect(reader.sideChatComposerQuoteTexts).toHaveCount(1)

  await sendSide(reader, "Why?")
  await expect(reader.sideChatTab("Why?")).toHaveAttribute("aria-selected", "true")
  await expect(reader.chatThread.getByText("Why?", { exact: true })).toBeHidden()
  expect((await requestBodies()).at(-1)).toMatchObject({
    messages: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: [
              SIDE_CHAT_INSTRUCTION,
              "",
              "User:\nMain question",
              "",
              "Assistant:\nReply to Main question",
            ].join("\n"),
          },
        ],
      },
      { role: "user", content: "Quoting from the conversation:\n> Reply to Main question\n\nWhy?" },
    ],
  })

  await sendMain(reader, "Main follow-up")
  expect((await requestBodies()).at(-1)?.messages).toEqual([
    { role: "user", content: "Main question" },
    { role: "assistant", content: "Reply to Main question" },
    { role: "user", content: "Main follow-up" },
  ])

  await sendSide(reader, "And now?")
  expect((await requestBodies()).at(-1)?.messages).toMatchObject([
    {
      role: "system",
      content: [
        { type: "text", text: expect.stringContaining("Assistant:\nReply to Main follow-up") },
      ],
    },
    { role: "user", content: expect.stringContaining("Why?") },
    { role: "assistant", content: "Reply to Why?" },
    { role: "user", content: "And now?" },
  ])

  await reader.selectSideChatMessageText("Reply to Why?")
  await expect(reader.chatSelectionToolbar).toBeVisible()
  await expect(reader.chatAskInSideChatButton).toHaveCount(0)
  await reader.chatAddToChatButton.click()
  await expect(reader.sideChatComposerQuoteTexts).toHaveText(["Reply to Why?"])
})

test("tabs open with the plus button, close with one confirmation, and survive a restart", async ({
  application,
}) => {
  const { reader } = await openChatWithReply(application, "Main question")

  await reader.toggleSideChatsButton.click()
  await expect(reader.sideChatPanel).toBeVisible()
  await expect(reader.sideChatTabs).toHaveText(["Side chat"])
  await sendSide(reader, "First side")
  await expect(reader.sideChatTabs).toHaveText(["First side"])

  await reader.newSideChatButton.click()
  await expect(reader.sideChatTabs).toHaveText(["First side", "Side chat"])
  await expect(reader.sideChatEmptyState).toBeVisible()
  await sendSide(reader, "Second side")
  await expect(reader.sideChatTabs).toHaveText(["First side", "Second side"])

  await reader.sideChatTab("First side").click()
  await expect(
    reader.sideChatThread.getByText("Reply to First side", { exact: true }),
  ).toBeVisible()
  await expect(reader.sideChatThread.getByText("Second side", { exact: true })).toBeHidden()

  await reader.closeSideChatButton("Second side").click()
  const dialog = application.page.getByRole("alertdialog", { name: "Close side chat?" })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(reader.sideChatTabs).toHaveText(["First side", "Second side"])

  await reader.closeSideChatButton("Second side").click()
  await dialog.getByRole("checkbox", { name: "Don't ask again" }).click()
  await dialog.getByRole("button", { name: "Close side chat", exact: true }).click()
  await expect(reader.sideChatTabs).toHaveText(["First side"])
  await expect(reader.sideChatTab("First side")).toHaveAttribute("aria-selected", "true")

  const restarted = await application.relaunch()
  const restored = new DocumentReaderDriver(restarted.page)
  await expect(restored.sideChatTabs).toHaveText(["First side"])
  await expect(
    restored.sideChatThread.getByText("Reply to First side", { exact: true }),
  ).toBeVisible()

  await restored.closeSideChatButton("First side").click()
  await expect(restarted.page.getByRole("alertdialog")).toHaveCount(0)
  await expect(restored.sideChatTabs).toHaveText(["Side chat"])
  await expect(restored.sideChatEmptyState).toBeVisible()

  await restored.closeSideChatButton("Side chat").click()
  await expect(restored.sideChatTabs).toHaveText(["Side chat"])
})

test("the side panel follows the active Chat Thread, resizes on its own, and goes with a deleted parent", async ({
  application,
}) => {
  const { reader } = await openChatWithReply(application, "Topic A")
  await reader.toggleSideChatsButton.click()
  await sendSide(reader, "Side of A")

  const width = await reader.sideChatPanelWidth()
  const handle = (await reader.sideChatPanelResizeHandle.boundingBox())!
  await application.page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await application.page.mouse.down()
  await application.page.mouse.move(handle.x - 80, handle.y + handle.height / 2, { steps: 5 })
  await application.page.mouse.up()
  await expect.poll(() => reader.sideChatPanelWidth()).toBeCloseTo(width + 80, -1)
  expect(await reader.chatPanelWidth()).toBeGreaterThanOrEqual(200)

  await reader.newChatThreadFromPanelButton.click()
  await expect(reader.chatPanelTitle).toHaveText("New chat")
  await expect(reader.toggleSideChatsButton).toBeDisabled()
  await expect(reader.sideChatPanel).toBeHidden()

  await sendMain(reader, "Topic B")
  await expect(reader.toggleSideChatsButton).toBeEnabled()
  await expect(reader.sideChatPanel).toBeVisible()
  await expect(reader.sideChatTabs).toHaveText(["Side chat"])

  await reader.chatThreadEntry("Topic A").click()
  await expect(reader.sideChatTabs).toHaveText(["Side of A"])
  await expect(reader.sideChatThread.getByText("Reply to Side of A", { exact: true })).toBeVisible()

  await reader.chatThreadEntry("Topic A").hover()
  await reader.chatThreadActionsButton("Topic A").click()
  await application.page.getByRole("menuitem", { name: "Delete" }).click()
  await application.page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(reader.chatThreadEntry("Topic A")).toHaveCount(0)
  await expect(reader.sideChatPanel).toBeHidden()

  const restarted = await application.relaunch()
  const restored = new DocumentReaderDriver(restarted.page)
  await restored.chatThreadEntry("Topic B").click()
  await expect(restored.sideChatTabs).toHaveText(["Side chat"])
  expect(await restarted.page.evaluate(() => window.pdfantom.listChatThreads())).toHaveLength(1)
})
