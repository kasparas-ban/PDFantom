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

test("reports a PDF loading failure", async ({ application }) => {
  await application.selectOpenPath(invalidDocumentFixture)
  const reader = new DocumentReaderDriver(application.page)

  await reader.openSelectedDocument()

  await expect(reader.loadingError()).toHaveText("This PDF could not be opened.")
  await expect(reader.renderedPages).toHaveCount(0)
})
