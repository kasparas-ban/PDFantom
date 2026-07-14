import { appendFile, copyFile, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")
const invalidDocumentFixture = path.resolve("tests/fixtures/pdfs/invalid.pdf")

const expectSpreadFullyVisible = async (
  reader: DocumentReaderDriver,
  leftPageNumber: number,
  rightPageNumber: number,
) => {
  await expect
    .poll(async () =>
      Math.min(
        ...Object.values(await reader.spreadVisibility(leftPageNumber, rightPageNumber)),
      ),
    )
    .toBeGreaterThanOrEqual(0)
}

test("toggles the Documents panel", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)

  await expect(reader.documentsPanel).toBeVisible()

  await reader.toggleDocumentsPanel("Hide")
  await expect(reader.documentsPanel).toBeHidden()

  await reader.toggleDocumentsPanel("Show")
  await expect(reader.documentsPanel).toBeVisible()
})

test("toggles the Chat panel", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)

  await expect(reader.chatPanel).toBeHidden()

  await reader.toggleChatPanel("Show")
  await expect(reader.chatPanel).toBeVisible()
  await expect(reader.chatEmptyState).toBeVisible()
  await expect(reader.chatMessageInput).toBeVisible()
  await expect(reader.chatAddAttachmentButton).toBeDisabled()
  await expect(reader.chatModelButton).toContainText("GPT-5.4 Nano")
  await expect(reader.chatModelButton).toBeDisabled()
  await expect(reader.chatVoiceInputButton).toBeDisabled()
  await expect(reader.chatSendMessageButton).toBeDisabled()
  await reader.writeChatMessage("Summarize this document")
  await expect(reader.chatMessageInput).toHaveValue("Summarize this document")
  await expect(reader.chatSendMessageButton).toBeEnabled()
  await expect(reader.chatPanelResizeHandle).toBeVisible()

  await reader.toggleChatPanel("Hide")
  await expect(reader.chatPanel).toBeHidden()
})

test("restores the Chat panel width after relaunch", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.resizeChatPanelBy(80)
  await application.electronApplication.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 820)
  })
  const resizedWidth = await reader.chatPanelWidth()

  const relaunched = await application.relaunch()
  const restoredReader = new DocumentReaderDriver(relaunched.page)
  await relaunched.application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 820)
  })

  await expect(restoredReader.chatPanel).toBeVisible()
  await expect.poll(() => restoredReader.chatPanelWidth()).toBe(resizedWidth)
})

test("preserves the Chat panel width when it is collapsed", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.resizeChatPanelBy(80)
  const resizedWidth = await reader.chatPanelWidth()

  await reader.toggleChatPanel("Hide")
  await expect(reader.chatPanel).toBeHidden()
  await reader.toggleChatPanel("Show")

  await expect(reader.chatPanel).toBeVisible()
  await expect.poll(() => reader.chatPanelWidth()).toBe(resizedWidth)
})

test("resizes the Chat panel from its border", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  const initialWidth = await reader.chatPanelWidth()

  await reader.resizeChatPanelBy(80)

  await expect.poll(() => reader.chatPanelWidth()).toBeCloseTo(initialWidth + 80, 0)
})

test("resizes the Chat panel with the keyboard", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  const initialWidth = await reader.chatPanelWidth()

  await reader.chatPanelResizeHandle.focus()
  await reader.chatPanelResizeHandle.press("ArrowLeft")

  await expect.poll(() => reader.chatPanelWidth()).toBe(initialWidth + 16)
})

test("restores preferred panel widths after a temporary window constraint", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.documentsPanelResizeHandle.focus()
  await reader.documentsPanelResizeHandle.press("End")
  await expect.poll(() => reader.documentsPanelWidth()).toBe(480)
  const preferredChatPanelWidth = await reader.chatPanelWidth()

  await application.electronApplication.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1000, 820)
  })

  await expect.poll(() => reader.readerAreaWidth()).toBeCloseTo(320, 0)

  await application.electronApplication.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1280, 820)
  })

  await expect.poll(() => reader.documentsPanelWidth()).toBe(480)
  await expect.poll(() => reader.chatPanelWidth()).toBe(preferredChatPanelWidth)
})

test("preserves the Documents panel width when it is collapsed", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.resizeDocumentsPanelBy(80)
  const resizedWidth = await reader.documentsPanelWidth()

  await reader.toggleDocumentsPanel("Hide")
  await expect(reader.documentsPanel).toBeHidden()
  await reader.toggleDocumentsPanel("Show")

  await expect(reader.documentsPanel).toBeVisible()
  await expect.poll(() => reader.documentsPanelWidth()).toBe(resizedWidth)
})

test("resizes the Documents panel from its border", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  const initialWidth = await reader.documentsPanelWidth()

  await reader.resizeDocumentsPanelBy(80)

  await expect.poll(() => reader.documentsPanelWidth()).toBeCloseTo(initialWidth + 80, 0)
})

test("resizes the Documents panel with the keyboard", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  const initialWidth = await reader.documentsPanelWidth()

  await reader.documentsPanelResizeHandle.focus()
  await reader.documentsPanelResizeHandle.press("ArrowRight")

  await expect.poll(() => reader.documentsPanelWidth()).toBe(initialWidth + 16)
})

test("only resizes the Documents panel with the primary pointer button", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  const initialWidth = await reader.documentsPanelWidth()

  await reader.resizeDocumentsPanelBy(80, "right")

  await expect.poll(() => reader.documentsPanelWidth()).toBe(initialWidth)
})

test("restores body styles when the Documents panel is hidden during resizing", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  const originalStyles = { cursor: "crosshair", userSelect: "text" }
  await reader.setBodyInteractionStyles(originalStyles)

  await reader.startResizingDocumentsPanel()
  await expect.poll(() => reader.bodyInteractionStyles()).toEqual({
    cursor: "col-resize",
    userSelect: "none",
  })

  await reader.toggleDocumentsPanelProgrammatically()

  await expect.poll(() => reader.bodyInteractionStyles()).toEqual(originalStyles)
  await application.page.mouse.up()
})

test("reclamps the Documents panel when the window shrinks", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.documentsPanelResizeHandle.focus()
  await reader.documentsPanelResizeHandle.press("End")
  await expect.poll(() => reader.documentsPanelWidth()).toBe(480)

  await application.electronApplication.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(760, 820)
  })

  await expect
    .poll(async () => application.page.evaluate(() => window.innerWidth - 320))
    .toBeLessThan(480)
  const maximumWidth = await application.page.evaluate(() =>
    Math.max(200, Math.min(480, window.innerWidth - 320)),
  )
  await expect.poll(() => reader.documentsPanelWidth()).toBe(maximumWidth)
  await expect(reader.documentsPanelResizeHandle).toHaveAttribute(
    "aria-valuemax",
    String(maximumWidth),
  )
})

test("opens and selects text without a Model Provider", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()

  await expect(reader.documentTitle("document-mock.pdf")).toBeVisible()
  await expect(reader.renderedPages).toHaveCount(5)
  await expect(reader.firstPageCanvas()).toBeVisible()

  await reader.selectPassage("Introduction to")
  await expect.poll(() => reader.selectedText()).toContain("Introduction to")
})

test("restores the last open Document at the first page after relaunch", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.documentEntry("document-mock.pdf")).toHaveAttribute(
    "aria-current",
    "page",
  )
  await expect(reader.renderedPages).toHaveCount(5)
  await reader.goToPage(4)
  await expect(reader.pageNumber).toHaveValue("4")

  const relaunched = await application.relaunch()
  const restoredReader = new DocumentReaderDriver(relaunched.page)

  await expect(restoredReader.documentEntry("document-mock.pdf")).toHaveAttribute(
    "aria-current",
    "page",
  )
  await expect(restoredReader.documentTitle("document-mock.pdf")).toBeVisible()
  await expect(restoredReader.renderedPages).toHaveCount(5)
  await expect(restoredReader.pageNumber).toHaveValue("1")
})

test("shows a repair state when the active Document changes before relaunch", async ({
  application,
}) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-unavailable-document-"))
  const sourcePath = path.join(workspace, "notes.pdf")

  try {
    await copyFile(documentFixture, sourcePath)
    await application.selectOpenPath(sourcePath)
    const reader = new DocumentReaderDriver(application.page)
    await reader.openSelectedDocument()
    await expect(reader.documentTitle("notes.pdf")).toBeVisible()

    await appendFile(sourcePath, "\n% changed after opening\n")
    const relaunched = await application.relaunch()
    const restoredReader = new DocumentReaderDriver(relaunched.page)

    await expect(restoredReader.documentEntry("notes.pdf")).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(
      relaunched.page.getByRole("heading", { name: "notes.pdf is unavailable" }),
    ).toBeVisible()
    await expect(
      relaunched.page.getByText("The file's contents changed after it was added."),
    ).toBeVisible()
    await expect(restoredReader.renderedPages).toHaveCount(0)
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test("persists every opened Document and activates it from the Documents panel", async ({
  application,
}) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-documents-"))
  const firstDocument = path.join(workspace, "first.pdf")
  const secondDocument = path.join(workspace, "second.pdf")

  try {
    await copyFile(documentFixture, firstDocument)
    await copyFile(documentFixture, secondDocument)

    const reader = new DocumentReaderDriver(application.page)
    await application.selectOpenPath(firstDocument)
    await reader.openSelectedDocument()
    await application.selectOpenPath(secondDocument)
    await reader.openAnotherSelectedDocument()

    await expect(reader.documentEntry("first.pdf")).toBeVisible()
    await expect(reader.documentEntry("second.pdf")).toHaveAttribute("aria-current", "page")
    await expect(reader.documentEntries()).toHaveText(["second.pdf", "first.pdf"])

    await reader.documentEntry("first.pdf").click()
    await expect(reader.documentEntry("first.pdf")).toHaveAttribute("aria-current", "page")
    await expect(reader.documentTitle("first.pdf")).toBeVisible()
    await expect(reader.renderedPages).toHaveCount(5)
    await expect(reader.documentEntries()).toHaveText(["second.pdf", "first.pdf"])

    await appendFile(secondDocument, "\n% changed after opening\n")
    const relaunched = await application.relaunch()
    const restoredReader = new DocumentReaderDriver(relaunched.page)

    await expect(restoredReader.documentEntry("first.pdf")).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(restoredReader.documentEntry("second.pdf")).toHaveAttribute(
      "title",
      "second.pdf",
    )
    await expect(restoredReader.documentEntries()).toHaveText(["second.pdf", "first.pdf"])
    await expect(restoredReader.documentTitle("first.pdf")).toBeVisible()
    await expect(restoredReader.renderedPages).toHaveCount(5)

    await restoredReader.documentEntry("second.pdf").click()
    await expect(restoredReader.loadingError()).toContainText(
      "The document is unavailable. Restore the file and try again.",
    )
    await expect(restoredReader.documentEntry("first.pdf")).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(restoredReader.documentEntry("second.pdf")).not.toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(restoredReader.documentTitle("first.pdf")).toBeVisible()

    await application.selectOpenPath(secondDocument)
    await restoredReader.openAnotherSelectedDocument()
    await expect(restoredReader.documentEntry("second.pdf")).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(restoredReader.documentTitle("second.pdf")).toBeVisible()
    await expect(restoredReader.renderedPages).toHaveCount(5)
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test("navigates document pages", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()

  await expect(reader.pageNumber).toHaveValue("1")
  await expect(reader.pageCountLabel(5)).toBeVisible()
  await expect(reader.previousPageButton).toBeDisabled()

  await reader.nextPage()
  await expect(reader.pageNumber).toHaveValue("2")
  await expect(reader.previousPageButton).toBeEnabled()

  await reader.goToPage(5)
  await expect(reader.pageNumber).toHaveValue("5")
  await expect(reader.nextPageButton).toBeDisabled()

  await reader.previousPage()
  await expect(reader.pageNumber).toHaveValue("4")

  await reader.goToPage(99)
  await expect(reader.pageNumber).toHaveValue("4")
})

test("navigates document pages with the arrow keys", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.pageNumber).toHaveValue("1")
  await expect(reader.pageNumber).toBeEnabled()

  await application.page.keyboard.press("ArrowRight")
  await expect(reader.pageNumber).toHaveValue("2")

  await application.page.keyboard.press("ArrowLeft")
  await expect(reader.pageNumber).toHaveValue("1")

  await application.page.keyboard.press("ArrowLeft")
  await expect(reader.pageNumber).toHaveValue("1")
})

test("keeps arrow keys available while editing the page number", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await reader.goToPage(2)
  await reader.pageNumber.press("ArrowRight")

  await expect(reader.pageNumber).toHaveValue("2")
})

test("navigates double-page spreads with one arrow-key press", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)
  await reader.pageViewButton.click()

  await application.page.keyboard.press("ArrowRight")
  await expect(reader.pageNumber).toHaveValue("3")
  await expectSpreadFullyVisible(reader, 3, 4)

  await application.page.keyboard.press("ArrowRight")
  await expect(reader.pageNumber).toHaveValue("5")

  await application.page.keyboard.press("ArrowLeft")
  await expect(reader.pageNumber).toHaveValue("3")
  await expectSpreadFullyVisible(reader, 3, 4)

  await application.page.keyboard.press("ArrowLeft")
  await expect(reader.pageNumber).toHaveValue("1")
  await expectSpreadFullyVisible(reader, 1, 2)
})

test("renders compact page spacing and bottom padding", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  const pageLayout = await reader.pageLayout()
  expect(pageLayout.gap).toBe(10)
  expect(pageLayout.bottomPadding).toBe(14)
})

test("lays out single pages vertically or horizontally with one control", async ({
  application,
}) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  await expect(reader.pageLayoutButton).toHaveCount(1)
  await expect(reader.pageLayoutButton).toHaveAccessibleName(
    "Switch to horizontal page layout",
  )
  expect(await reader.pageTop(1)).not.toBe(await reader.pageTop(2))

  await reader.pageLayoutButton.click()

  await expect(reader.pageLayoutButton).toHaveAccessibleName("Switch to vertical page layout")
  await expect.poll(async () => (await reader.pageTop(2)) - (await reader.pageTop(1))).toBe(0)
  await expect.poll(() => reader.horizontalPageGap(1, 2)).toBeGreaterThan(0)
  await reader.pageFitButton.click()
  await expect
    .poll(async () => {
      const gutters = await reader.pageVerticalGutters(1)
      return Math.abs(gutters.top - gutters.bottom)
    })
    .toBeLessThanOrEqual(2)

  await reader.pageLayoutButton.click()

  await expect(reader.pageLayoutButton).toHaveAccessibleName(
    "Switch to horizontal page layout",
  )
  await expect
    .poll(async () => (await reader.pageTop(2)) - (await reader.pageTop(1)))
    .toBeGreaterThan(0)
})

test("lays out double-page spreads vertically or horizontally with gutters", async ({
  application,
}) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)
  await reader.pageViewButton.click()

  await expect.poll(async () => (await reader.pageTop(2)) - (await reader.pageTop(1))).toBe(0)
  await expect.poll(() => reader.verticalPageGap(1, 3)).toBeGreaterThanOrEqual(8)

  await reader.pageLayoutButton.click()

  await expect(reader.pageLayoutButton).toHaveAccessibleName("Switch to vertical page layout")
  await expect.poll(async () => (await reader.pageTop(3)) - (await reader.pageTop(1))).toBe(0)
  await expect.poll(() => reader.horizontalPageGap(2, 3)).toBeGreaterThan(0)
  await expect
    .poll(async () => {
      const gutters = await reader.pageVerticalGutters(1)
      return Math.abs(gutters.top - gutters.bottom)
    })
    .toBeLessThanOrEqual(2)

  await reader.pageLayoutButton.click()

  await expect(reader.pageLayoutButton).toHaveAccessibleName(
    "Switch to horizontal page layout",
  )
  await expect.poll(() => reader.verticalPageGap(1, 3)).toBeGreaterThanOrEqual(8)
})

test("toggles between single and double page views with one control", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  await expect(reader.pageViewButton).toHaveCount(1)
  await expect(reader.pageViewButton).toHaveAccessibleName("Switch to double-page view")
  expect(await reader.pageTop(1)).not.toBe(await reader.pageTop(2))
  await reader.setReaderSize({ width: 300 })

  await reader.pageViewButton.click()

  await expect(reader.pageViewButton).toHaveAccessibleName("Switch to single-page view")
  await expect(reader.pageFitButton).toHaveAccessibleName("Fit to width")
  expect(await reader.pageTop(1)).toBe(await reader.pageTop(2))
  expect(await reader.horizontalPageGap(1, 2)).toBe(2)
  expect(await reader.horizontalOverflow()).toBe(0)
  await expectSpreadFullyVisible(reader, 1, 2)
  await expect
    .poll(async () => {
      const page = await reader.firstPageSize()
      const readerSize = await reader.readerSize()
      return (page.width * 2 + 2) / readerSize.width
    })
    .toBeGreaterThan(0.95)

  await reader.pageFitButton.click()
  await expect(reader.pageFitButton).toHaveAccessibleName("Fit to page")
  expect(await reader.horizontalOverflow()).toBe(0)
  await reader.pageFitButton.click()

  await reader.setReaderSize({ height: 150, width: 1_000 })
  await expectSpreadFullyVisible(reader, 1, 2)
  await expect
    .poll(async () => {
      const page = await reader.firstPageSize()
      const readerSize = await reader.readerSize()
      return page.height / readerSize.height
    })
    .toBeGreaterThan(0.9)

  await reader.pageViewButton.click()

  await expect(reader.pageViewButton).toHaveAccessibleName("Switch to double-page view")
  expect(await reader.pageTop(1)).not.toBe(await reader.pageTop(2))
})

test("keeps the current page in view when switching to double-page view", async ({
  application,
}) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)
  await reader.goToPage(4)
  await expect(reader.pageNumber).toHaveValue("4")

  await reader.pageViewButton.click()

  await expect(reader.pageNumber).toHaveValue("4")
  await expectSpreadFullyVisible(reader, 3, 4)
})

test("fits the document to the page or reader width", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  await expect(reader.pageFitButton).toHaveAccessibleName("Fit to page")
  await reader.pageFitButton.click()
  await expect(reader.pageFitButton).toHaveAccessibleName("Fit to width")
  const pageFitSize = await reader.firstPageSize()
  const pageFitVisibility = await reader.firstPageVisibility()
  expect(pageFitVisibility.top).toBeGreaterThanOrEqual(0)
  expect(pageFitVisibility.bottom).toBeLessThanOrEqual(0)

  await reader.pageFitButton.click()
  await expect(reader.pageFitButton).toHaveAccessibleName("Fit to page")
  await expect
    .poll(async () => (await reader.firstPageSize()).width)
    .toBeGreaterThan(pageFitSize.width)
  const pageWidthSize = await reader.firstPageSize()
  await expect
    .poll(async () => {
      const { left, right } = await reader.firstPageHorizontalVisibility()
      return Math.max(left, right)
    })
    .toBeLessThanOrEqual(1)
  await expect(reader.zoomLevel).not.toHaveText("100%")

  await reader.zoomInButton.click()
  await expect(reader.pageFitButton).toHaveAccessibleName("Fit to page")
  await expect
    .poll(async () => (await reader.firstPageSize()).width)
    .toBeGreaterThan(pageWidthSize.width)
})

test("zooms around the trackpad pinch position", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  const pinch = await reader.pinchFirstPage(1.2, 100)
  expect(pinch.defaultPrevented).toBe(true)
  await expect(reader.zoomLevel).toHaveText("119%")

  const pointAfter = await reader.firstPagePoint(0.5, 0.35)
  expect(pointAfter.x).toBeCloseTo(pinch.pointBefore.x, 0)
  expect(Math.abs(pointAfter.y - pinch.pointBefore.y)).toBeLessThanOrEqual(12)
})

test("caps zoom at 500%", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  await reader.pinchFirstPage(10, 100)

  await expect(reader.zoomLevel).toHaveText("500%")
  await expect(reader.zoomInButton).toBeDisabled()
})

test("caps zoom out at 25%", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  await reader.pinchFirstPage(0.1, 100)

  await expect(reader.zoomLevel).toHaveText("25%")
  await expect(reader.zoomOutButton).toBeDisabled()
})

test("caps fit-to-width zoom at 500%", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  await reader.setReaderSize({ width: 5_000 })
  await reader.pageFitButton.click()
  await reader.pageFitButton.click()

  await expect(reader.zoomLevel).toHaveText("500%")
})

test("caps fit-to-page zoom at 25%", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  await reader.setReaderSize({ height: 100 })
  await reader.pageFitButton.click()

  await expect(reader.zoomLevel).toHaveText("25%")
})

test("leaves a fit preset when trackpad pinching", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  await reader.pageFitButton.click()
  await expect(reader.pageFitButton).toHaveAccessibleName("Fit to width")

  await reader.pinchFirstPage(1.1)
  await expect(reader.pageFitButton).toHaveAccessibleName("Fit to page")
})

test("does not treat physical Control scrolling as a pinch", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  const ctrlScroll = await reader.ctrlScrollFirstPage()
  expect(ctrlScroll.defaultPrevented).toBe(false)
  await expect(reader.zoomLevel).toHaveText("100%")
})

test("reports a PDF loading failure", async ({ application }) => {
  await application.selectOpenPath(invalidDocumentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()

  await expect(reader.loadingError()).toHaveText("This PDF could not be opened.")
  await expect(reader.renderedPages).toHaveCount(0)
})
