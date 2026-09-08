import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import type { launchTestApplication } from "./launch-application"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

type ControlledChatStream = {
  aborted: boolean
  body: { messages: { role: string; content: string }[] }
  controller: ReadableStreamDefaultController<Uint8Array>
}

async function installControllableOpenRouter(
  application: Awaited<ReturnType<typeof launchTestApplication>>,
) {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    const encoder = new TextEncoder()
    const streams: ControlledChatStream[] = []
    Reflect.set(globalThis, "chatStreams", streams)

    globalThis.fetch = async (_input, init) => {
      if (typeof init?.body !== "string") throw new Error("Expected a JSON request body")
      const body = JSON.parse(init.body)

      return new Response(
        new ReadableStream({
          start(controller) {
            const stream = { aborted: false, body, controller }
            streams.push(stream)
            init.signal?.addEventListener(
              "abort",
              () => {
                stream.aborted = true
                controller.error(new DOMException("Aborted", "AbortError"))
              },
              { once: true },
            )
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      )
    }

    Reflect.set(globalThis, "finishChatStream", (index: number, text: string) => {
      const stream = streams[index]
      if (!stream) throw new Error(`No chat stream at index ${index}`)

      stream.controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`),
      )
      stream.controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      stream.controller.close()
    })
  })

  const streamCount = () =>
    application.electronApplication.evaluate(() => {
      const streams: ControlledChatStream[] = Reflect.get(globalThis, "chatStreams")
      return streams.length
    })
  const requestBodies = () =>
    application.electronApplication.evaluate(() => {
      const streams: ControlledChatStream[] = Reflect.get(globalThis, "chatStreams")
      return streams.map((stream) => stream.body)
    })
  const isStreamAborted = (index: number) =>
    application.electronApplication.evaluate((_electron, streamIndex) => {
      const streams: ControlledChatStream[] = Reflect.get(globalThis, "chatStreams")
      return streams[streamIndex]?.aborted
    }, index)
  const finishStream = (index: number, text: string) =>
    application.electronApplication.evaluate(
      (_electron, [streamIndex, streamText]) => {
        const finish: (index: number, text: string) => void = Reflect.get(
          globalThis,
          "finishChatStream",
        )
        finish(streamIndex, streamText)
      },
      [index, text] as const,
    )

  return { finishStream, isStreamAborted, requestBodies, streamCount }
}

test("queues messages sent during a response and sends them in order afterwards", async ({
  application,
}) => {
  const openRouter = await installControllableOpenRouter(application)
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")

  await reader.writeChatMessage("First")
  await reader.chatSendMessageButton.click()
  await expect.poll(openRouter.streamCount).toBe(1)

  await reader.writeChatMessage("Second")
  await reader.chatMessageInput.press("Enter")
  await expect(reader.chatQueuedMessage("Second")).toBeVisible()
  await expect(reader.chatMessageInput).toHaveValue("")

  await reader.writeChatMessage("Third")
  await reader.chatQueueMessageButton.click()
  await expect(reader.chatQueuedMessageTexts).toHaveText(["Second", "Third"])
  await expect(reader.chatStopResponseButton).toBeVisible()
  expect(await openRouter.streamCount()).toBe(1)

  await reader
    .chatQueuedMessage("Third")
    .getByRole("button", { name: "Remove queued message" })
    .click()
  await expect(reader.chatQueuedMessageTexts).toHaveText(["Second"])

  await openRouter.finishStream(0, "First answer")
  await expect(reader.chatThread.getByText("First answer", { exact: true })).toBeVisible()
  await expect(reader.chatQueuedMessages).toHaveCount(0)
  await expect.poll(openRouter.streamCount).toBe(2)

  await openRouter.finishStream(1, "Second answer")
  await expect(reader.chatThread.getByText("Second answer", { exact: true })).toBeVisible()
  await expect(reader.chatThread.getByText("Third", { exact: true })).toBeHidden()
  expect(await openRouter.requestBodies()).toMatchObject([
    { messages: [{ role: "user", content: "First" }] },
    {
      messages: [
        { role: "user", content: "First" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Second" },
      ],
    },
  ])
})

test("Interrupt stops the current response and sends the queued message right away", async ({
  application,
}) => {
  const openRouter = await installControllableOpenRouter(application)
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await reader.toggleChatPanel("Show")

  await reader.writeChatMessage("First")
  await reader.chatSendMessageButton.click()
  await expect.poll(openRouter.streamCount).toBe(1)

  await reader.writeChatMessage("Second")
  await reader.chatMessageInput.press("Enter")
  await reader.writeChatMessage("Third")
  await reader.chatMessageInput.press("Enter")
  await expect(reader.chatQueuedMessageTexts).toHaveText(["Second", "Third"])

  await reader.chatQueuedMessage("Third").getByRole("button", { name: "Interrupt" }).click()
  await expect.poll(() => openRouter.isStreamAborted(0)).toBe(true)
  await expect.poll(openRouter.streamCount).toBe(2)
  await expect(reader.chatQueuedMessageTexts).toHaveText(["Second"])
  await expect(reader.chatStopResponseButton).toBeVisible()
  await expect(
    reader.chatThread.getByText("Unable to generate response. Please try again later."),
  ).toBeHidden()

  await openRouter.finishStream(1, "Third answer")
  await expect(reader.chatThread.getByText("Third answer", { exact: true })).toBeVisible()
  await expect.poll(openRouter.streamCount).toBe(3)
  await openRouter.finishStream(2, "Second answer")
  await expect(reader.chatThread.getByText("Second answer", { exact: true })).toBeVisible()

  expect((await openRouter.requestBodies()).map((body) => body.messages.at(-1))).toEqual([
    { role: "user", content: "First" },
    { role: "user", content: "Third" },
    { role: "user", content: "Second" },
  ])
})
