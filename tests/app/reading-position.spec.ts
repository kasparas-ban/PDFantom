import { copyFile, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type { Page } from "@playwright/test"

import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")
const readerViewport = (page: Page) => page.getByLabel("PDF reader", { exact: true })
const scrollPosition = (page: Page) =>
  readerViewport(page).evaluate((reader) => ({
    left: reader.scrollLeft,
    top: reader.scrollTop,
  }))

for (const layout of ["vertical", "horizontal", "double"] as const) {
  test(`restores precise ${layout} reading position and zoom after app restart`, async ({
    application,
  }) => {
    const reader = new DocumentReaderDriver(application.page)
    await application.selectOpenPath(documentFixture)
    await reader.openSelectedDocument()
    await expect(reader.pageCountLabel(5)).toBeVisible()
    await expect(application.page.getByText("Opening document-mock.pdf…")).toBeHidden()
    if (layout === "horizontal") await reader.pageLayoutButton.click()
    if (layout === "double") await reader.pageViewButton.click()
    await reader.zoomInButton.click()
    await reader.zoomInButton.click()
    await reader.zoomInButton.click()
    await reader.goToPage(3)
    await expect(reader.pageNumber).toHaveValue("3")
    await readerViewport(application.page).evaluate((viewport, direction) => {
      viewport.scrollBy(direction === "horizontal" ? { left: 137 } : { top: 137 })
    }, layout)
    const position = await scrollPosition(application.page)
    const pageNumber = await reader.pageNumber.inputValue()
    const zoom = await reader.zoomLevel.textContent()

    const restarted = await application.relaunch()
    const restored = new DocumentReaderDriver(restarted.page)
    await expect(restarted.page.getByText("Opening document-mock.pdf…")).toBeHidden()
    await expect(restored.pageNumber).toHaveValue(pageNumber)
    await expect(restored.zoomLevel).toHaveText(zoom!)
    await expect.poll(() => scrollPosition(restarted.page)).toEqual(position)
    await expect(restored.pageLayoutButton).toHaveAccessibleName(
      layout === "horizontal"
        ? "Switch to vertical page layout"
        : "Switch to horizontal page layout",
    )
    await expect(restored.pageViewButton).toHaveAccessibleName(
      layout === "double" ? "Switch to single-page view" : "Switch to double-page view",
    )
  })
}

test("remembers independent positions when switching and reopening Documents", async ({
  application,
}) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-reading-position-"))
  try {
    const secondPath = path.join(workspace, "second.pdf")
    await copyFile(documentFixture, secondPath)
    const reader = new DocumentReaderDriver(application.page)
    await application.selectOpenPath(documentFixture)
    await reader.openSelectedDocument()
    await expect(reader.pageCountLabel(5)).toBeVisible()
    await reader.goToPage(4)
    await reader.offsetReaderScrollBy(83)
    const firstPosition = await scrollPosition(application.page)

    await application.selectOpenPath(secondPath)
    await reader.openAnotherSelectedDocument()
    await expect(reader.pageNumber).toHaveValue("1")
    await reader.goToPage(2)
    await reader.offsetReaderScrollBy(49)
    const secondPosition = await scrollPosition(application.page)

    await reader.documentEntry("document-mock.pdf").click()
    await expect(reader.pageNumber).toHaveValue("4")
    await expect.poll(() => scrollPosition(application.page)).toEqual(firstPosition)

    await reader.documentEntry("second.pdf").click()
    await expect(reader.pageNumber).toHaveValue("2")
    await expect.poll(() => scrollPosition(application.page)).toEqual(secondPosition)

    await application.selectOpenPath(documentFixture)
    await reader.openAnotherSelectedDocument()
    await expect(reader.pageNumber).toHaveValue("4")
    await expect.poll(() => scrollPosition(application.page)).toEqual(firstPosition)

    const restarted = await application.relaunch()
    const restored = new DocumentReaderDriver(restarted.page)
    await expect(restored.pageNumber).toHaveValue("4")
    await expect.poll(() => scrollPosition(restarted.page)).toEqual(firstPosition)
    await restored.documentEntry("second.pdf").click()
    await expect(restored.pageNumber).toHaveValue("2")
    await expect.poll(() => scrollPosition(restarted.page)).toEqual(secondPosition)
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test("flushes a final scroll when quitting before the next scroll event", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  await expect(application.page.getByRole("button", { name: "Choose a PDF" })).toBeVisible()
  await application.page.evaluate(() => {
    window.addEventListener(
      "beforeunload",
      () => {
        const viewport = document.querySelector('[aria-label="PDF reader"]')
        if (viewport) viewport.scrollTop += 93
      },
      { once: true },
    )
  })
  await application.selectOpenPath(documentFixture)
  await reader.openSelectedDocument()
  await expect(reader.pageCountLabel(5)).toBeVisible()
  await reader.goToPage(4)
  const before = await scrollPosition(application.page)

  const restarted = await application.relaunch()
  const restored = new DocumentReaderDriver(restarted.page)
  await expect(restored.pageNumber).toHaveValue("4")
  await expect
    .poll(() => scrollPosition(restarted.page))
    .toEqual({ ...before, top: before.top + 93 })
})

test("does not overwrite the reading position when quitting with Settings open", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await application.selectOpenPath(documentFixture)
  await reader.openSelectedDocument()
  await expect(reader.pageCountLabel(5)).toBeVisible()
  await reader.goToPage(4)
  await reader.offsetReaderScrollBy(83)
  const position = await scrollPosition(application.page)
  const zoom = await reader.zoomLevel.textContent()

  await reader.settingsButton.click()
  await expect(reader.settings).toBeVisible()
  const restarted = await application.relaunch()
  const restored = new DocumentReaderDriver(restarted.page)
  await expect(restored.pageNumber).toHaveValue("4")
  await expect(restored.zoomLevel).toHaveText(zoom!)
  await expect(restored.pageFitButton).toHaveAccessibleName("Fit to width")
  await expect.poll(() => scrollPosition(restarted.page)).toEqual(position)
})

test("restores the position after restart with an obsolete view preference", async ({
  application,
}) => {
  const reader = new DocumentReaderDriver(application.page)
  await application.selectOpenPath(documentFixture)
  await reader.openSelectedDocument()
  await expect(reader.pageCountLabel(5)).toBeVisible()
  await reader.zoomInButton.click()
  await reader.goToPage(4)
  await reader.offsetReaderScrollBy(83)
  const position = await scrollPosition(application.page)
  const zoom = await reader.zoomLevel.textContent()

  const storageKey = await application.page.evaluate(async () => {
    const { activeDocument } = await window.pdfantom.getDocumentLibrary()
    if (activeDocument.status !== "loaded") throw new Error("No document is open")
    const key = `pdfantom-reading-position:${activeDocument.document.id}`
    window.addEventListener(
      "beforeunload",
      () => {
        const record = JSON.parse(window.localStorage.getItem(key)!)
        window.localStorage.setItem(
          key,
          JSON.stringify({ ...record, scalePreset: "obsolete-fit-preset" }),
        )
      },
      { once: true },
    )
    return key
  })

  const restarted = await application.relaunch()
  const restored = new DocumentReaderDriver(restarted.page)
  await expect(restored.pageNumber).toHaveValue("4")
  await expect(restored.zoomLevel).toHaveText(zoom!)
  await expect.poll(() => scrollPosition(restarted.page)).toEqual(position)
  const savedRecord = await restarted.page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key)!),
    storageKey,
  )
  expect(savedRecord).toMatchObject({ pageNumber: 4, scalePreset: null })
})
