import { copyFile, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

test("search stays reader-scoped and supports live results, navigation, reopen, and selection", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await expect(reader.renderedPages).toHaveCount(5)

  await reader.toggleChatPanel("Show")
  await reader.chatMessageInput.focus()
  await application.page.keyboard.press("Meta+f")
  await expect(reader.documentSearch).toHaveCount(0)

  await reader.nextPageButton.focus()
  await application.page.keyboard.press("Meta+f")
  await expect(reader.documentSearchInput).toBeFocused()
  await reader.documentSearchCloseButton.click()
  await expect(reader.nextPageButton).toBeFocused()

  await reader.openDocumentSearch()
  await expect(reader.documentSearchInput).toBeFocused()
  await reader.documentSearchInput.fill("introduction to ecosystems")
  await expect(reader.documentSearchCount).toHaveText("1 / 5")
  await expect(reader.documentSearchMatches.first()).toBeVisible()
  await expect(reader.selectedDocumentSearchMatch.first()).toBeVisible()
  await expect.poll(() => reader.selectedDocumentSearchPage()).toBe("1")

  await application.page.keyboard.press("Meta+f")
  await expect(reader.documentSearchInput).toBeFocused()
  await expect
    .poll(() =>
      reader.documentSearchInput.evaluate(
        (input) =>
          input instanceof HTMLInputElement &&
          input.selectionStart === 0 &&
          input.selectionEnd === input.value.length,
      ),
    )
    .toBe(true)

  await reader.documentSearchInput.press("Enter")
  await expect(reader.documentSearchCount).toHaveText("2 / 5")
  await expect(reader.pageNumber).toHaveValue("2")

  await reader.documentSearchInput.press("Shift+Enter")
  await expect(reader.documentSearchCount).toHaveText("1 / 5")
  await reader.documentSearchPreviousButton.click()
  await expect(reader.documentSearchCount).toHaveText("5 / 5")
  await expect(reader.documentSearch.getByText("Search wrapped")).toBeAttached()
  await expect(reader.pageNumber).toHaveValue("5")

  await reader.documentSearchNextButton.click()
  await expect(reader.documentSearchCount).toHaveText("1 / 5")
  await expect(reader.pageNumber).toHaveValue("1")

  await reader.documentSearchInput.fill("no such embedded phrase")
  await expect(reader.documentSearchCount).toHaveText("0 / 0")
  await expect(reader.documentSearch.getByText("No matches")).toBeAttached()
  await reader.documentSearchCloseButton.focus()
  await reader.documentSearchCloseButton.press("Escape")
  await expect(reader.documentSearch).toHaveCount(0)
  await expect(reader.documentSearchMatches).toHaveCount(0)
  await expect(reader.presentedReader).toBeFocused()

  await application.page.keyboard.press("Meta+f")
  await expect(reader.documentSearchInput).toHaveValue("no such embedded phrase")
  await expect(reader.documentSearchCount).toHaveText("0 / 0")
  await reader.documentSearchCloseButton.click()
  await expect(reader.documentSearch).toHaveCount(0)

  await reader.selectPassage("Introduction to")
  await expect.poll(() => reader.selectedText()).toContain("Introduction to")
})

test("switching Documents closes and resets search", async ({ application }) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pdfantom-search-"))
  const firstDocument = path.join(directory, "first.pdf")
  const secondDocument = path.join(directory, "second.pdf")

  try {
    await copyFile(documentFixture, firstDocument)
    await copyFile(documentFixture, secondDocument)
    const reader = new DocumentReaderDriver(application.page)

    await reader.openFixtureDocument(application, firstDocument)
    await reader.openDocumentSearch()
    await reader.documentSearchInput.fill("ecosystem")
    await expect(reader.documentSearchCount).toHaveText("1 / 14")

    await application.selectOpenPath(secondDocument)
    await reader.openAnotherSelectedDocument()
    await expect(reader.documentTitle("second.pdf")).toBeVisible()
    await expect(reader.documentSearch).toHaveCount(0)
    await expect(reader.documentSearchMatches).toHaveCount(0)

    await reader.openDocumentSearch()
    await expect(reader.documentSearchInput).toHaveValue("")
    await expect(reader.documentSearchCount).toHaveText("")
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("search stays below the toolbar at narrow reader widths", async ({ application }) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.openFixtureDocument(application, documentFixture)
  await expect(reader.nextPageButton).toBeEnabled()
  await reader.toggleChatPanel("Show")
  await application.electronApplication.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(1000, 700)
  })

  const toolbar = application.page.getByRole("toolbar", { name: "PDF reader toolbar" })
  await expect.poll(() => application.page.evaluate(() => window.innerWidth)).toBeGreaterThan(760)
  await expect.poll(() => toolbar.evaluate((element) => element.clientWidth)).toBeLessThan(760)

  await reader.openDocumentSearch()
  await expect(toolbar.getByRole("group", { name: "Reader controls" })).toBeVisible()
  await expect
    .poll(async () => {
      const [toolbarBounds, searchBounds] = await Promise.all([
        toolbar.boundingBox(),
        reader.documentSearch.boundingBox(),
      ])

      return Boolean(
        toolbarBounds &&
          searchBounds &&
          searchBounds.y >= toolbarBounds.y + toolbarBounds.height,
      )
    })
    .toBe(true)
})
