import path from "node:path"

import { expect, test } from "@playwright/test"

import { launchTestApplication } from "./launch-application"

const textbookFixture = path.resolve("tests/fixtures/pdfs/textbook-mock.pdf")

test("toggles the sidebar", async () => {
  const application = await launchTestApplication({ workspacePrefix: "pdfantom-sidebar" })

  try {
    const { page } = application
    const sidebar = page.getByRole("complementary")
    await expect(sidebar).toBeVisible()

    await page.getByRole("button", { name: "Hide sidebar" }).click()

    await expect(sidebar).toBeHidden()

    await page.getByRole("button", { name: "Show sidebar" }).click()

    await expect(sidebar).toBeVisible()
  } finally {
    await application.close()
  }
})

test("opens, reads, and selects text without a Model Provider", async () => {
  const application = await launchTestApplication({
    openPath: textbookFixture,
    workspacePrefix: "pdfantom-reader",
  })

  try {
    const { page } = application
    await page.getByRole("button", { name: "Open textbook" }).click()

    await expect(page.getByRole("heading", { name: "textbook-mock.pdf" })).toBeVisible()
    await expect(page.getByText("5 pages")).toBeVisible()
    await expect(page.getByText("Selectable text available")).toBeVisible()
    await expect(page.locator(".pdf-page > .canvasWrapper > canvas")).toHaveCount(5)

    const passage = page.getByText("Introduction to", { exact: true })
    await passage.selectText()
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toContain("Introduction to")
  } finally {
    await application.close()
  }
})
