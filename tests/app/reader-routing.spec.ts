import path from "node:path"

import type { Page } from "@playwright/test"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

// Sampling begins before navigation, with animations enabled. Check every painted
// descendant, including portals and deliberately visible children of the hidden page.
async function sampleDeparture(page: Page) {
  await page.evaluate(() => {
    const reader = document.querySelector('main[aria-label="Reader"]')!
    const sentinel = document.createElement("div")
    sentinel.textContent = "Paint isolation sentinel"
    sentinel.style.cssText =
      "visibility:visible;position:fixed;top:0;left:0;transition:all 150ms;background:red"
    reader.append(sentinel)
    Reflect.set(
      window,
      "departureFrames",
      new Promise<{ frames: number; leaks: string[]; focusLeaks: number }>((resolve) => {
        let firstDestination = 0
        let frames = 0
        let focusLeaks = 0
        const leaks: string[] = []
        const trackFocus = (event: FocusEvent) => {
          if (
            event.target instanceof Node &&
            reader.contains(event.target) &&
            !reader.checkVisibility()
          ) {
            focusLeaks++
          }
        }
        document.addEventListener("focusin", trackFocus)
        // eslint-disable-next-line unicorn/consistent-function-scoping -- This function is serialized into the renderer.
        const painted = (element: Element) =>
          element.checkVisibility({ visibilityProperty: true, opacityProperty: true })
        const sample = (now: number) => {
          const settings = document.querySelector('main[aria-label="Settings"]')
          if (settings && painted(settings)) {
            firstDestination ||= now
            frames++
            for (const element of reader.querySelectorAll("*")) {
              if (painted(element)) {
                leaks.push(element.tagName + ":" + element.getAttribute("aria-label"))
              }
            }
            for (const menu of document.querySelectorAll('[role="menu"]')) {
              if (painted(menu)) leaks.push("portal")
            }
            if (reader.contains(document.activeElement)) focusLeaks++
          }
          if (firstDestination && now - firstDestination >= 200) {
            sentinel.remove()
            document.removeEventListener("focusin", trackFocus)
            resolve({ frames, leaks, focusLeaks })
          } else {
            requestAnimationFrame(sample)
          }
        }
        requestAnimationFrame(sample)
      }),
    )
  })
}

async function expectIsolatedDeparture(page: Page) {
  const result: { frames: number; leaks: string[]; focusLeaks: number } = await page.evaluate(() =>
    Reflect.get(window, "departureFrames"),
  )
  expect(result.frames).toBeGreaterThan(1)
  expect(result.leaks).toEqual([])
  expect(result.focusLeaks).toBe(0)
}

test("provider links and Settings isolate the reader from the first destination frame", async ({
  application,
}) => {
  const { page } = application
  const reader = new DocumentReaderDriver(page)
  await reader.toggleChatPanel("Show")
  await expect(reader.openAiProviderSettingsFromChatButton).toBeVisible()
  await sampleDeparture(page)
  await reader.openAiProviderSettingsFromChatButton.click()
  await expect(page).toHaveURL(/#\/settings\/provider$/)
  await expectIsolatedDeparture(page)
  await expect(page.getByRole("heading", { name: "AI Provider", exact: true })).toBeFocused()
  await reader.backToAppButton.click()

  // Exercise the second provider link through a failed request at the fetch boundary.
  await page.evaluate(() => {
    window.fetch = async () => new Response("Mock failure", { status: 500 })
  })
  await reader.writeChatMessage("Fail this mocked request")
  await reader.chatSendMessageButton.click()
  await expect(reader.openAiProviderSettingsFromChatButton).toBeVisible()
  await sampleDeparture(page)
  await reader.openAiProviderSettingsFromChatButton.click()
  await expect(page).toHaveURL(/#\/settings\/provider$/)
  await expectIsolatedDeparture(page)
  await reader.backToAppButton.click()

  await reader.chatModelButton.click()
  await reader.chatModelFilterInput.fill("mini")
  await sampleDeparture(page)
  await reader.settingsButton.evaluate((link: HTMLAnchorElement) => link.click())
  await expect(page).toHaveURL(/#\/settings\/general$/)
  await expectIsolatedDeparture(page)
  await reader.backToAppButton.click()
  await expect(reader.chatModelFilterInput).toHaveCount(0)
  await reader.chatModelButton.click()
  await expect(reader.chatModelFilterInput).toHaveValue("")
})

test("Activity retains exact PDF geometry, canvas, selection, chat draft and model", async ({
  application,
}) => {
  const { page } = application
  const reader = new DocumentReaderDriver(page)
  await reader.toggleChatPanel("Show")
  await application.selectOpenPath(path.resolve("tests/fixtures/pdfs/document-mock.pdf"))
  await reader.openSelectedDocument()
  await expect(reader.nextPageButton).toBeEnabled()
  await reader.goToPage(2)
  await reader.zoomInButton.click()
  await reader.writeChatMessage("Keep this draft")
  await reader.chatModelButton.click()
  await reader.chatModelOption("GPT-5.4 Mini").click()
  await expect(
    page.locator('[data-presented="true"] .page[data-page-number="2"] .textLayer'),
  ).toHaveAttribute("data-main-rotation", "0")
  await reader.offsetReaderScrollBy(37)
  const before = await page.evaluate(() => {
    const container = document.querySelector<HTMLElement>('[aria-label="PDF reader"]')!
    const text = container.querySelector('.page[data-page-number="2"] .textLayer span')!
    const range = document.createRange()
    range.selectNodeContents(text)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    Reflect.set(
      window,
      "retainedCanvas",
      container.querySelector('.page[data-page-number="2"] canvas'),
    )
    return {
      scrollTop: container.scrollTop,
      scrollLeft: container.scrollLeft,
      selection: window.getSelection()!.toString(),
    }
  })
  const zoom = await reader.zoomLevel.textContent()
  await reader.settingsButton.evaluate((link: HTMLAnchorElement) => link.click())
  await expect(reader.settings).toBeVisible()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Tab")
  expect(
    await page.evaluate(() => document.activeElement?.closest("main")?.getAttribute("aria-label")),
  ).toBe("Settings")
  await reader.backToAppButton.click()
  await expect(reader.pageNumber).toHaveValue("2")
  await expect(reader.zoomLevel).toHaveText(zoom!)
  await expect(reader.chatMessageInput).toHaveValue("Keep this draft")
  await expect(reader.chatModelButton).toContainText("GPT-5.4 Mini")
  const after = await page.evaluate(() => {
    const container = document.querySelector<HTMLElement>('[aria-label="PDF reader"]')!
    return {
      scrollTop: container.scrollTop,
      scrollLeft: container.scrollLeft,
      selection: window.getSelection()!.toString(),
      sameCanvas:
        Reflect.get(window, "retainedCanvas") ===
        container.querySelector('.page[data-page-number="2"] canvas'),
    }
  })
  expect(after).toEqual({ ...before, sameCanvas: true })
  await page.evaluate(() => window.getSelection()?.removeAllRanges())
  await reader.settingsButton.click()
  await reader.backToAppButton.click()
  expect(await reader.selectedText()).toBe("")
  await reader.toggleChatPanel("Hide")
  await reader.toggleChatPanel("Show")
  await expect(reader.chatMessageInput).toHaveValue("Keep this draft")
  await expect(reader.chatModelButton).toContainText("GPT-5.4 Mini")
})

test("in-flight chat continues while hidden and returns with messages and model", async ({
  application,
}) => {
  const { page } = application
  const reader = new DocumentReaderDriver(page)
  await reader.toggleChatPanel("Show")
  await reader.chatModelButton.click()
  await reader.chatModelOption("GPT-5.4 Mini").click()
  await page.evaluate(() => {
    window.fetch = async (_url, init) => {
      Reflect.set(
        window,
        "chatRequest",
        JSON.parse(typeof init?.body === "string" ? init.body : "null"),
      )
      const encoder = new TextEncoder()
      return new Response(
        new ReadableStream({
          start(controller) {
            const send = (event: unknown) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            send({ type: "start", messageId: "mock-response" })
            send({ type: "text-start", id: "text" })
            send({ type: "text-delta", id: "text", delta: "Started " })
            Reflect.set(window, "finishChat", () => {
              send({ type: "text-delta", id: "text", delta: "while hidden" })
              send({ type: "text-end", id: "text" })
              send({ type: "finish" })
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
              controller.close()
            })
          },
        }),
        { headers: { "Content-Type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" } },
      )
    }
  })
  await reader.writeChatMessage("Mock a response")
  await reader.chatSendMessageButton.click()
  await expect(page.getByRole("button", { name: "Stop response" })).toBeVisible()
  await reader.settingsButton.click()
  await expect(reader.settings).toBeVisible()
  await page.evaluate(() => {
    const finish: () => void = Reflect.get(window, "finishChat")
    finish()
  })
  await reader.backToAppButton.click()
  await expect(reader.chatPanel.getByText("Started while hidden")).toBeVisible()
  await expect(reader.chatPanel.getByText("Mock a response")).toBeVisible()
  await expect(reader.chatModelButton).toContainText("GPT-5.4 Mini")
  await expect(page.getByRole("button", { name: "Stop response" })).toHaveCount(0)
})

test("departure releases resize capture and body styles; initial Settings, history and IPC work", async ({
  application,
}) => {
  const { page } = application
  const reader = new DocumentReaderDriver(page)
  await reader.toggleChatPanel("Show")
  await reader.setBodyInteractionStyles({ cursor: "crosshair", userSelect: "text" })
  await reader.startResizingDocumentsPanel()
  await reader.settingsButton.evaluate((link: HTMLAnchorElement) => link.click())
  await expect(reader.settings).toBeVisible()
  expect(await reader.bodyInteractionStyles()).toEqual({ cursor: "crosshair", userSelect: "text" })
  expect(
    await page
      .locator('[aria-label="Resize documents panel"]')
      .evaluate((handle) => handle.hasPointerCapture(1)),
  ).toBe(false)
  await page.mouse.up()
  await reader.aiProviderSettingsButton.click()
  await reader.editOpenRouterApiKeyButton.click()
  await reader.openRouterApiKeyInput.fill("unsaved-draft")
  await reader.appearanceSettingsButton.click()
  await reader.aiProviderSettingsButton.click()
  await expect(reader.openRouterApiKeyInput).toHaveValue("")
  await expect(reader.openRouterApiKeyInput).not.toBeEditable()
  await page.getByRole("link", { name: "General", exact: true }).click()
  await reader.appearanceSettingsButton.click()
  await expect(page.getByRole("heading", { name: "Appearance", exact: true })).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(/#\/settings\/general$/)
  await page.goForward()
  await expect(page).toHaveURL(/#\/settings\/appearance$/)
  await page.reload()
  await expect(reader.settings).toBeVisible()
  await expect(page.locator("[data-reader-version]")).toHaveCount(0)
  expect(
    await page.evaluate(async () => ({
      library: (await window.pdfantom.getDocumentLibrary()).documents,
      key: await window.pdfantom.getOpenRouterApiKeyStatus(),
      fullScreen: await window.pdfantom.getIsFullScreen(),
    })),
  ).toEqual({ library: [], key: { isConfigured: false }, fullScreen: false })
  await reader.backToAppButton.click()
  await expect(reader.documentsPanel).toBeVisible()
  await page.evaluate(() => {
    window.location.hash = "/settings"
  })
  await expect(page).toHaveURL(/#\/settings\/general$/)
  await page.goBack()
  await expect(reader.documentsPanel).toBeVisible()
  await page.evaluate(() => {
    window.location.hash = "/missing"
  })
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible()
  await page.getByRole("link", { name: "Back to app" }).click()
  await expect(reader.documentsPanel).toBeVisible()
})

test("a document loaded in Settings stays inactive and reconciles resized fit geometry on return", async ({
  application,
}) => {
  const { page } = application
  const reader = new DocumentReaderDriver(page)
  await reader.toggleChatPanel("Show")
  await application.selectOpenPath(path.resolve("tests/fixtures/pdfs/document-mock.pdf"))
  await reader.openSelectedDocument()
  await expect(reader.nextPageButton).toBeEnabled()
  await application.electronApplication.evaluate(({ ipcMain }) => {
    const handlers: Map<string, (...args: unknown[]) => unknown> = Reflect.get(
      ipcMain,
      "_invokeHandlers",
    )
    const original = handlers.get("document:load")!
    const gate = Promise.withResolvers<void>()
    Reflect.set(globalThis, "releaseRoutingLoad", gate.resolve)
    ipcMain.removeHandler("document:load")
    ipcMain.handle("document:load", async (...args) => {
      await gate.promise
      return original(...args)
    })
  })
  await page.reload()
  await reader.settingsButton.click()
  await expect(reader.settings).toBeVisible()
  await application.electronApplication.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(980, 700)
    const release: () => void = Reflect.get(globalThis, "releaseRoutingLoad")
    release()
  })
  await reader.appearanceSettingsButton.click()
  await page.getByRole("radio", { name: "Dark" }).check()
  await expect(page.locator("[data-reader-version]")).toHaveCount(1)
  await expect(page.locator('[data-presented="true"]')).toHaveCount(0)
  await expect(page.locator('[data-reader-preview="true"]')).toHaveCount(0)
  await expect(page.locator("[data-reader-version] canvas")).toHaveCount(0)
  await reader.backToAppButton.click()
  await expect(reader.nextPageButton).toBeEnabled()
  await expect(reader.firstPageCanvas()).toBeVisible()
  expect(await reader.horizontalOverflow()).toBeLessThanOrEqual(1)
  expect(await page.locator("html").getAttribute("class")).toContain("dark")
})
