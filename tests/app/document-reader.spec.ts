import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")
const invalidDocumentFixture = path.resolve("tests/fixtures/pdfs/invalid.pdf")

test("toggles the sidebar", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)

  await expect(reader.sidebar).toBeVisible()

  await reader.toggleSidebar()
  await expect(reader.sidebar).toBeHidden()

  await reader.toggleSidebar()
  await expect(reader.sidebar).toBeVisible()
})

test("preserves the sidebar width when it is collapsed", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.resizeSidebarBy(80)
  const resizedWidth = await reader.sidebarWidth()

  await reader.toggleSidebar()
  await expect(reader.sidebar).toBeHidden()
  await reader.toggleSidebar()

  await expect(reader.sidebar).toBeVisible()
  await expect.poll(() => reader.sidebarWidth()).toBe(resizedWidth)
})

test("resizes the sidebar from its border", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  const initialWidth = await reader.sidebarWidth()

  await reader.resizeSidebarBy(80)

  await expect.poll(() => reader.sidebarWidth()).toBeCloseTo(initialWidth + 80, 0)
})

test("resizes the sidebar with the keyboard", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  const initialWidth = await reader.sidebarWidth()

  await reader.sidebarResizeHandle.focus()
  await reader.sidebarResizeHandle.press("ArrowRight")

  await expect.poll(() => reader.sidebarWidth()).toBe(initialWidth + 16)
})

test("only resizes the sidebar with the primary pointer button", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  const initialWidth = await reader.sidebarWidth()

  await reader.resizeSidebarBy(80, "right")

  await expect.poll(() => reader.sidebarWidth()).toBe(initialWidth)
})

test("restores body styles when the sidebar is hidden during resizing", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  const originalStyles = { cursor: "crosshair", userSelect: "text" }
  await reader.setBodyInteractionStyles(originalStyles)

  await reader.startResizingSidebar()
  await expect.poll(() => reader.bodyInteractionStyles()).toEqual({
    cursor: "col-resize",
    userSelect: "none",
  })

  await reader.toggleSidebarProgrammatically()

  await expect.poll(() => reader.bodyInteractionStyles()).toEqual(originalStyles)
  await application.page.mouse.up()
})

test("reclamps the sidebar when the window shrinks", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.sidebarResizeHandle.focus()
  await reader.sidebarResizeHandle.press("End")
  await expect.poll(() => reader.sidebarWidth()).toBe(480)

  await application.electronApplication.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(760, 820)
  })

  await expect
    .poll(async () => application.page.evaluate(() => window.innerWidth - 320))
    .toBeLessThan(480)
  const maximumWidth = await application.page.evaluate(() =>
    Math.max(200, Math.min(480, window.innerWidth - 320)),
  )
  await expect.poll(() => reader.sidebarWidth()).toBe(maximumWidth)
  await expect(reader.sidebarResizeHandle).toHaveAttribute("aria-valuemax", String(maximumWidth))
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

test("renders page spacing and bottom padding", async ({ application }) => {
  await application.selectOpenPath(documentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()
  await expect(reader.renderedPages).toHaveCount(5)

  const pageLayout = await reader.pageLayout()
  expect(pageLayout.gap).toBeGreaterThanOrEqual(24)
  expect(pageLayout.bottomPadding).toBeGreaterThanOrEqual(24)
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
