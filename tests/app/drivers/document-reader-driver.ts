import type { Page } from "@playwright/test"

export class DocumentReaderDriver {
  constructor(private readonly page: Page) {}

  get sidebar() {
    return this.page.getByRole("complementary")
  }

  get renderedPages() {
    return this.page.locator(".pdfViewer .page")
  }

  get pageNumber() {
    return this.page.getByRole("spinbutton", { name: "Page number" })
  }

  get previousPageButton() {
    return this.page.getByRole("button", { name: "Previous page" })
  }

  get nextPageButton() {
    return this.page.getByRole("button", { name: "Next page" })
  }

  toggleSidebar() {
    return this.page.getByRole("button", { name: "Hide sidebar" }).click()
  }

  openSelectedDocument() {
    return this.page.getByRole("button", { name: "Choose a PDF" }).click()
  }

  documentTitle(name: string) {
    return this.page.getByRole("heading", { name })
  }

  pageCountLabel(pageCount: number) {
    return this.page.getByText(`of ${pageCount}`, { exact: true })
  }

  loadingError() {
    return this.page.getByRole("alert")
  }

  async selectPassage(text: string) {
    await this.page.getByText(text, { exact: true }).selectText()
  }

  selectedText() {
    return this.page.evaluate(() => window.getSelection()?.toString())
  }

  async goToPage(pageNumber: number) {
    await this.pageNumber.fill(String(pageNumber))
    await this.pageNumber.press("Enter")
  }

  nextPage() {
    return this.nextPageButton.click()
  }

  previousPage() {
    return this.previousPageButton.click()
  }

  firstPageCanvas() {
    return this.renderedPages.first().locator(".canvasWrapper > canvas")
  }

  pageLayout() {
    return this.renderedPages.evaluateAll((pages) => {
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
  }
}
