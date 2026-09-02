import { appendFile, copyFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

test("retained readers preserve actual canvases, selection and isolated controls before a source check", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  await application.selectOpenPath(path.resolve("tests/fixtures/pdfs/document-mock.pdf"))
  await reader.openSelectedDocument()
  await expect(reader.pageNumber).toBeEnabled()
  await reader.goToPage(2)
  await reader.selectPassage("What Is an Ecosystem?")
  expect(await reader.selectedText()).toBe("What Is an Ecosystem?")
  const original = await application.page.locator('[data-presented="true"]').elementHandle()
  await application.selectOpenPath(path.resolve("tests/fixtures/pdfs/mixed-page-sizes.pdf"))
  await reader.openAnotherSelectedDocument()
  await expect(reader.documentEntry("mixed-page-sizes.pdf")).toHaveAttribute("aria-current", "page")
  await reader.goToPage(4)
  await application.electronApplication.evaluate(({ ipcMain }) => {
    const handlers: Map<string, (...args: unknown[]) => unknown> = Reflect.get(
      ipcMain,
      "_invokeHandlers",
    )
    const originalHandler = handlers.get("document:load")!
    const gate = Promise.withResolvers<void>()
    Reflect.set(globalThis, "releaseCheck", gate.resolve)
    ipcMain.removeHandler("document:load")
    ipcMain.handle("document:load", async (...args) => {
      await gate.promise
      return originalHandler(...args)
    })
  })
  await reader.documentEntry("document-mock.pdf").click()
  await expect(reader.pageNumber).toHaveValue("2")
  await expect(reader.pageNumber).toBeEnabled()
  expect(await reader.selectedText()).toBe("What Is an Ecosystem?")
  await expect(application.page.getByText("Checking source…", { exact: true })).toBeVisible()
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector('[data-presented="true"]'),
    ),
  ).toBe(true)
  await reader.goToPage(1)
  await reader.selectPassage("Introduction to")
  expect(await reader.selectedText()).toBe("Introduction to")
  const copied = await application.page
    .locator('[data-presented="true"] .textLayer')
    .first()
    .evaluate((layer) => {
      const clipboardData = new DataTransfer()
      layer.dispatchEvent(
        new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData }),
      )
      return clipboardData.getData("text/plain")
    })
  expect(copied).toBe("Introduction to")
  const isolation = await application.page.evaluate(() => {
    const inactive = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-reader-version]:not([data-presented="true"])',
      ),
    ]
    const ids = [...document.querySelectorAll("[id]")].map(({ id }) => id)
    return {
      inactive: inactive.every(
        (element) => element.inert && element.getAttribute("aria-hidden") === "true",
      ),
      uniqueIds: new Set(ids).size === ids.length,
    }
  })
  expect(isolation).toEqual({ inactive: true, uniqueIds: true })
  await application.electronApplication.evaluate(() => {
    const release: () => void = Reflect.get(globalThis, "releaseCheck")
    release()
  })
  await expect(application.page.getByText("Checking source…", { exact: true })).toBeHidden()
})

test("explicitly replacing the same path invalidates the version and starts at defaults", async ({
  application,
}) => {
  await mkdir(test.info().outputDir, { recursive: true })
  const source = test.info().outputPath("replacement.pdf")
  await copyFile(path.resolve("tests/fixtures/pdfs/document-mock.pdf"), source)
  const reader = new DocumentReaderDriver(application.page)
  await application.selectOpenPath(source)
  await reader.openSelectedDocument()
  await reader.goToPage(4)
  await reader.zoomInButton.click()
  const previous = await application.page.evaluate(() => window.pdfantom.getDocumentLibrary())
  await appendFile(source, "\n% explicit version replacement\n")
  await reader.openAnotherSelectedDocument()
  await expect(reader.pageNumber).toHaveValue("1")
  await expect(reader.pageFitButton).toHaveAccessibleName("Fit to width")
  const current = await application.page.evaluate(() => window.pdfantom.getDocumentLibrary())
  expect(current.selectedDocument?.id).toBe(previous.selectedDocument?.id)
  expect(current.selectedDocument?.fingerprint).not.toBe(previous.selectedDocument?.fingerprint)
  await expect(application.page.locator("[data-reader-version]")).toHaveCount(1)
  const restarted = await application.relaunch()
  await expect(new DocumentReaderDriver(restarted.page).pageNumber).toHaveValue("1")
})

test("a header-valid but unparsable PDF fails meaningfully after file verification", async ({
  application,
}) => {
  await mkdir(test.info().outputDir, { recursive: true })
  const source = test.info().outputPath("unparsable.pdf")
  await writeFile(source, "%PDF-1.7\nThis is not a PDF object graph.\n%%EOF")
  await application.selectOpenPath(source)
  await application.page.getByRole("button", { name: "Choose a PDF" }).click()
  await expect(application.page.getByRole("alert")).toContainText("This PDF could not be opened")
  await expect(application.page.locator("[data-reader-version]")).toHaveCount(0)
})

test("reactivates a zoomed retained viewport after resize without exposing a stale fit", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  await application.selectOpenPath(path.resolve("tests/fixtures/pdfs/document-mock.pdf"))
  await reader.openSelectedDocument()
  await expect(reader.pageNumber).toBeEnabled()
  await reader.pinchFirstPage(8, 100)
  await expect(reader.zoomLevel).toHaveText("500%")
  await reader.zoomOutButton.click()
  const zoom = await reader.zoomLevel.textContent()
  await application.selectOpenPath(path.resolve("tests/fixtures/pdfs/mixed-page-sizes.pdf"))
  await reader.openAnotherSelectedDocument()
  await expect(reader.documentEntry("mixed-page-sizes.pdf")).toHaveAttribute("aria-current", "page")
  await application.electronApplication.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1000, 700),
  )
  await reader.documentEntry("document-mock.pdf").click()
  await expect(reader.documentEntry("document-mock.pdf")).toHaveAttribute("aria-current", "page")
  await expect(reader.pageNumber).toBeEnabled()
  await expect(reader.zoomLevel).toHaveText(zoom!)
})
