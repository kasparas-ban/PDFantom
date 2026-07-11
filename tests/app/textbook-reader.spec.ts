import path from "node:path"

import { expect, test } from "@playwright/test"

import { launchTestApplication } from "./launch-application"

const textbookFixture = path.resolve("tests/fixtures/pdfs/textbook-mock.pdf")

test("a Student opens, reads, and selects text without a Model Provider", async () => {
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

test("the renderer exposes only the constrained Textbook boundary", async () => {
  const application = await launchTestApplication({
    workspacePrefix: "pdfantom-security",
  })

  try {
    const { page } = application
    await expect(page.getByRole("button", { name: "Open textbook" })).toBeVisible()

    const boundary = await page.evaluate(() => ({
      api: Object.keys(window.pdfantom),
      ipcRenderer: typeof (window as Window & { ipcRenderer?: unknown }).ipcRenderer,
      nodeProcess: typeof (window as Window & { process?: unknown }).process,
      nodeRequire: typeof (window as Window & { require?: unknown }).require,
    }))
    expect(boundary).toEqual({
      api: ["openTextbook"],
      ipcRenderer: "undefined",
      nodeProcess: "undefined",
      nodeRequire: "undefined",
    })

    await expect
      .poll(() =>
        page.evaluate(async () => {
          try {
            await fetch("https://example.com/")
            return "allowed"
          } catch {
            return "blocked"
          }
        }),
      )
      .toBe("blocked")

    const originalUrl = page.url()
    expect(await page.evaluate(() => window.open("https://example.com/"))).toBeNull()
    await page.evaluate(() => {
      const link = document.createElement("a")
      link.href = "https://example.com/"
      document.body.append(link)
      link.click()
    })
    await expect.poll(() => page.url()).toBe(originalUrl)
  } finally {
    await application.close()
  }
})
