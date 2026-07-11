import path from "node:path"

import { expect, test } from "@playwright/test"

import { launchTestApplication } from "./launch-application"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")

test("toggles the sidebar", async () => {
  const application = await launchTestApplication({ workspacePrefix: "pdfantom-sidebar" })

  try {
    const { page } = application
    const sidebar = page.getByRole("complementary")
    await expect(sidebar).toBeVisible()

    await page.getByRole("button", { name: "Hide sidebar" }).click()

    await expect(sidebar).toBeHidden()

    await page.getByRole("button", { name: "Hide sidebar" }).click()

    await expect(sidebar).toBeVisible()
  } finally {
    await application.close()
  }
})

test("opens, reads, and selects text without a Model Provider", async () => {
  const application = await launchTestApplication({
    openPath: documentFixture,
    workspacePrefix: "pdfantom-reader",
  })

  try {
    const { page } = application
    await page.getByRole("button", { name: "Choose a PDF" }).click()

    await expect(page.getByRole("heading", { name: "document-mock.pdf" })).toBeVisible()
    await expect(page.locator(".pdfViewer .page")).toHaveCount(5)
    await expect(page.locator(".pdfViewer .page").first().locator(".canvasWrapper > canvas")).toBeVisible()

    const pageSpacing = await page.locator(".pdfViewer .page").evaluateAll((pages) => {
      const reader = pages[0].closest<HTMLElement>('[aria-label="PDF reader"]')
      if (!reader) throw new Error("PDF reader container was not found")

      reader.scrollTop = reader.scrollHeight

      const firstPage = pages[0].getBoundingClientRect()
      const secondPage = pages[1].getBoundingClientRect()
      const lastPage = pages.at(-1)!.getBoundingClientRect()
      const readerBounds = reader.getBoundingClientRect()

      return {
        gap: secondPage.top - firstPage.bottom,
        bottomPadding: readerBounds.bottom - lastPage.bottom,
      }
    })

    expect(pageSpacing.gap).toBeGreaterThanOrEqual(24)
    expect(pageSpacing.bottomPadding).toBeGreaterThanOrEqual(24)

    const passage = page.getByText("Introduction to", { exact: true })
    await passage.selectText()
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toContain("Introduction to")
  } finally {
    await application.close()
  }
})
