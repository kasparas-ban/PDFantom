import { copyFile, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import type { launchTestApplication } from "./launch-application"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

type Application = Awaited<ReturnType<typeof launchTestApplication>>

async function installEchoingOpenRouter(application: Application) {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    const bodies: { model: string; messages: { role: string; content: string }[] }[] = []
    Reflect.set(globalThis, "chatBodies", bodies)

    globalThis.fetch = async (_input, init) => {
      if (typeof init?.body !== "string") throw new Error("Expected a JSON request body")

      const body = JSON.parse(init.body)
      bodies.push(body)
      const prompt: string = body.messages.at(-1).content

      return new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Reply to ${prompt}` } }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      )
    }
  })

  return () =>
    application.electronApplication.evaluate(() => {
      const bodies: { model: string; messages: { role: string; content: string }[] }[] =
        Reflect.get(globalThis, "chatBodies")

      return bodies
    })
}

async function send(reader: DocumentReaderDriver, text: string) {
  await reader.writeChatMessage(text)
  await reader.chatSendMessageButton.click()
  await expect(reader.chatThread.getByText(`Reply to ${text}`, { exact: true })).toBeVisible()
}

test("a Draft becomes a Chat Thread on first send and the thread survives a restart", async ({
  application,
}) => {
  await installEchoingOpenRouter(application)
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")

  await expect(reader.chatPanelTitle).toHaveText("New chat")
  await expect(reader.chatThreadList("document-mock.pdf")).toBeHidden()

  await send(reader, "Explain the first chapter")

  await expect(reader.chatPanelTitle).toHaveText("Explain the first chapter")
  await expect(reader.chatThreadEntries("document-mock.pdf")).toHaveText([
    "Explain the first chapter",
  ])
  await expect(reader.chatThreadEntry("Explain the first chapter")).toHaveAttribute(
    "aria-current",
    "true",
  )

  const restarted = await application.relaunch()
  const restored = new DocumentReaderDriver(restarted.page)
  await expect(restored.chatThreadEntries("document-mock.pdf")).toHaveText([
    "Explain the first chapter",
  ])
  await expect(restored.chatPanelTitle).toHaveText("Explain the first chapter")
  await expect(
    restored.chatThread.getByText("Explain the first chapter", { exact: true }),
  ).toBeVisible()
  await expect(
    restored.chatThread.getByText("Reply to Explain the first chapter", { exact: true }),
  ).toBeVisible()
  await expect(restored.chatEmptyState).toBeHidden()
})

test("a Document holds several Chat Threads, each with its own transcript and Model", async ({
  application,
}) => {
  const requestBodies = await installEchoingOpenRouter(application)
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await reader.chatModelButton.click()
  await reader.chatModelOption("GPT-5.4 Mini").click()
  await send(reader, "First topic")

  await reader.newChatThreadButton("document-mock.pdf").click()
  await expect(reader.chatPanelTitle).toHaveText("New chat")
  await expect(reader.chatThread.getByText("First topic", { exact: true })).toBeHidden()
  await reader.chatModelButton.click()
  await reader.chatModelOption("GPT-5.4 Nano").click()
  await send(reader, "Second topic")

  await expect(reader.chatThreadEntries("document-mock.pdf")).toHaveText([
    "Second topic",
    "First topic",
  ])

  await reader.chatThreadEntry("First topic").click()
  await expect(reader.chatPanelTitle).toHaveText("First topic")
  await expect(reader.chatThread.getByText("Reply to First topic", { exact: true })).toBeVisible()
  await expect(reader.chatThread.getByText("Second topic", { exact: true })).toBeHidden()
  await expect(reader.chatModelButton).toContainText("GPT-5.4 Mini")

  await send(reader, "Follow-up")
  const bodies = await requestBodies()
  expect(bodies.at(-1)).toMatchObject({
    model: "openai/gpt-5.4-mini",
    messages: [
      { role: "user", content: "First topic" },
      { role: "assistant", content: "Reply to First topic" },
      { role: "user", content: "Follow-up" },
    ],
  })
  await expect(reader.chatThreadEntries("document-mock.pdf")).toHaveText([
    "First topic",
    "Second topic",
  ])

  await reader.chatThreadEntry("Second topic").click()
  await expect(reader.chatModelButton).toContainText("GPT-5.4 Nano")

  await reader.toggleChatThreadsButton("document-mock.pdf").click()
  await expect(reader.chatThreadList("document-mock.pdf")).toBeHidden()
  await reader.toggleChatThreadsButton("document-mock.pdf").click()
  await expect(reader.chatThreadEntries("document-mock.pdf")).toHaveCount(2)
})

test("deleting the visible Chat Thread leaves a Draft and removes it for good", async ({
  application,
}) => {
  await installEchoingOpenRouter(application)
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")
  await send(reader, "Doomed thread")

  await reader.chatThreadEntry("Doomed thread").hover()
  await reader.chatThreadActionsButton("Doomed thread").click()
  await application.page.getByRole("menuitem", { name: "Delete" }).click()
  await expect(
    application.page.getByRole("alertdialog", { name: "Delete this chat thread?" }),
  ).toBeVisible()
  await application.page.getByRole("button", { name: "Cancel" }).click()
  await expect(reader.chatThreadEntry("Doomed thread")).toBeVisible()

  await reader.chatThreadEntry("Doomed thread").hover()
  await reader.chatThreadActionsButton("Doomed thread").click()
  await application.page.getByRole("menuitem", { name: "Delete" }).click()
  await application.page.getByRole("button", { name: "Delete", exact: true }).click()

  await expect(reader.chatThreadEntry("Doomed thread")).toHaveCount(0)
  await expect(reader.chatPanelTitle).toHaveText("New chat")
  await expect(reader.chatEmptyState).toBeVisible()

  const restarted = await application.relaunch()
  const restored = new DocumentReaderDriver(restarted.page)
  await expect(restored.documentEntry("document-mock.pdf")).toHaveAttribute("aria-current", "page")
  await expect(restored.chatThreadList("document-mock.pdf")).toBeHidden()
})

test("switching Documents switches Chat Threads, and the chat waits for a Document", async ({
  application,
}) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-chat-threads-"))

  try {
    const secondPath = path.join(workspace, "second.pdf")
    await copyFile(documentFixture, secondPath)
    await installEchoingOpenRouter(application)
    const reader = new DocumentReaderDriver(application.page)
    await reader.toggleChatPanel("Show")

    await expect(reader.chatThread.getByText("Open a PDF to start a chat")).toBeVisible()
    await expect(reader.chatMessageInput).toBeDisabled()
    await expect(reader.newChatThreadFromPanelButton).toBeDisabled()

    await reader.openFixtureDocument(application, documentFixture)
    await expect(reader.chatMessageInput).toBeEnabled()
    await send(reader, "About the first document")

    await application.selectOpenPath(secondPath)
    await reader.openAnotherSelectedDocument()
    await expect(reader.documentEntry("second.pdf")).toHaveAttribute("aria-current", "page")
    await expect(reader.chatPanelTitle).toHaveText("New chat")
    await send(reader, "About the second document")

    await expect(reader.chatThreadEntries("second.pdf")).toHaveText(["About the second document"])
    await expect(reader.chatThreadEntries("document-mock.pdf")).toHaveText([
      "About the first document",
    ])

    await reader.chatThreadEntry("About the first document").click()
    await expect(reader.documentEntry("document-mock.pdf")).toHaveAttribute("aria-current", "page")
    await expect(reader.chatPanelTitle).toHaveText("About the first document")

    await reader.documentEntry("second.pdf").click()
    await expect(reader.chatPanelTitle).toHaveText("About the second document")
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test("a reply keeps streaming in the background while another Chat Thread is open", async ({
  application,
}) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    const encoder = new TextEncoder()
    globalThis.fetch = async (_input, init) => {
      if (typeof init?.body !== "string") throw new Error("Expected a JSON request body")

      const prompt: string = JSON.parse(init.body).messages.at(-1).content
      if (prompt !== "Slow question") {
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content: `Reply to ${prompt}` } }] })}\n\ndata: [DONE]\n\n`,
          { headers: { "Content-Type": "text/event-stream" } },
        )
      }

      return new Response(
        new ReadableStream({
          start(controller) {
            Reflect.set(globalThis, "finishSlowReply", () => {
              controller.enqueue(
                encoder.encode(
                  'data: {"choices":[{"delta":{"content":"Slow reply arrived"}}]}\n\n',
                ),
              )
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
              controller.close()
            })
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      )
    }
  })
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")

  await reader.writeChatMessage("Slow question")
  await reader.chatSendMessageButton.click()
  await expect(reader.chatStopResponseButton).toBeVisible()
  await expect(reader.chatThreadEntry("Slow question")).toBeVisible()
  await expect(
    reader.chatThreadList("document-mock.pdf").getByRole("status", { name: "Responding" }),
  ).toBeVisible()

  await reader.newChatThreadButton("document-mock.pdf").click()
  await expect(reader.chatPanelTitle).toHaveText("New chat")
  await send(reader, "Quick question")
  await expect(
    reader.chatThreadList("document-mock.pdf").getByRole("status", { name: "Responding" }),
  ).toBeVisible()

  await application.electronApplication.evaluate(() => {
    const finish: () => void = Reflect.get(globalThis, "finishSlowReply")
    finish()
  })
  await expect(
    reader.chatThreadList("document-mock.pdf").getByRole("status", { name: "Responding" }),
  ).toBeHidden()

  await reader.chatThreadEntry("Slow question").click()
  await expect(reader.chatThread.getByText("Slow reply arrived", { exact: true })).toBeVisible()
  await expect(reader.chatStopResponseButton).toBeHidden()
})
