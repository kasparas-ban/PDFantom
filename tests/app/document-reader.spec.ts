import path from "node:path"

import { expect, test } from "@playwright/test"

import { launchTestApplication } from "./launch-application"

const documentFixture = path.resolve("tests/fixtures/pdfs/document-mock.pdf")
const invalidDocumentFixture = path.resolve("tests/fixtures/pdfs/invalid.pdf")

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

test("opens and selects text without a Model Provider", async () => {
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

    const passage = page.getByText("Introduction to", { exact: true })
    await passage.selectText()
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toContain("Introduction to")
  } finally {
    await application.close()
  }
})

test("navigates document pages", async () => {
  const application = await launchTestApplication({
    openPath: documentFixture,
    workspacePrefix: "pdfantom-page-navigation",
  })

  try {
    const { page } = application
    await page.getByRole("button", { name: "Choose a PDF" }).click()

    const pageNumber = page.getByRole("spinbutton", { name: "Page number" })
    const previousPage = page.getByRole("button", { name: "Previous page" })
    const nextPage = page.getByRole("button", { name: "Next page" })

    await expect(pageNumber).toHaveValue("1")
    await expect(page.getByText("of 5", { exact: true })).toBeVisible()
    await expect(previousPage).toBeDisabled()

    await nextPage.click()
    await expect(pageNumber).toHaveValue("2")
    await expect(previousPage).toBeEnabled()

    await pageNumber.fill("5")
    await pageNumber.press("Enter")
    await expect(pageNumber).toHaveValue("5")
    await expect(nextPage).toBeDisabled()

    await previousPage.click()
    await expect(pageNumber).toHaveValue("4")

    await pageNumber.fill("99")
    await pageNumber.press("Enter")
    await expect(pageNumber).toHaveValue("4")
  } finally {
    await application.close()
  }
})

test("renders page spacing and bottom padding", async () => {
  const application = await launchTestApplication({
    openPath: documentFixture,
    workspacePrefix: "pdfantom-page-spacing",
  })

  try {
    const { page } = application
    await page.getByRole("button", { name: "Choose a PDF" }).click()
    await expect(page.locator(".pdfViewer .page")).toHaveCount(5)

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
  } finally {
    await application.close()
  }
})

test("reports a PDF loading failure", async () => {
  const application = await launchTestApplication({
    openPath: invalidDocumentFixture,
    workspacePrefix: "pdfantom-invalid-reader",
  })

  try {
    const { page } = application
    await page.getByRole("button", { name: "Choose a PDF" }).click()

    await expect(page.getByRole("alert")).toHaveText("This PDF could not be opened.")
    await expect(page.locator(".pdfViewer .page")).toHaveCount(0)
  } finally {
    await application.close()
  }
})
