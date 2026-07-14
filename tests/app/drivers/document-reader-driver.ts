import type { Page } from "@playwright/test"

export class DocumentReaderDriver {
  constructor(private readonly page: Page) {}

  get documentsPanel() {
    return this.page.getByRole("complementary", { name: "Documents panel" })
  }

  get documentsPanelResizeHandle() {
    return this.page.getByRole("separator", { name: "Resize documents panel" })
  }

  get chatPanel() {
    return this.page.getByRole("complementary", { name: "Chat panel" })
  }

  get chatMessageInput() {
    return this.chatPanel.getByRole("textbox", { name: "Message" })
  }

  get chatEmptyState() {
    return this.chatPanel.getByText("How can I help you today?")
  }

  get chatAddAttachmentButton() {
    return this.chatPanel.getByRole("button", { name: "Add attachment" })
  }

  get chatModelButton() {
    return this.chatPanel.getByRole("button", { name: "Choose model" })
  }

  get chatVoiceInputButton() {
    return this.chatPanel.getByRole("button", { name: "Voice input" })
  }

  get chatSendMessageButton() {
    return this.chatPanel.getByRole("button", { name: "Send message" })
  }

  get chatPanelResizeHandle() {
    return this.page.getByRole("separator", { name: "Resize chat panel" })
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

  get pageFitButton() {
    return this.page.getByRole("button", { name: /Fit to (page|width)/ })
  }

  get pageViewButton() {
    return this.page.getByRole("button", { name: /Switch to (double|single)-page view/ })
  }

  get pageLayoutButton() {
    return this.page.getByRole("button", {
      name: /Switch to (horizontal|vertical) page layout/,
    })
  }

  get zoomInButton() {
    return this.page.getByRole("button", { name: "Zoom in" })
  }

  get zoomOutButton() {
    return this.page.getByRole("button", { name: "Zoom out" })
  }

  get zoomLevel() {
    return this.page.getByRole("status", { name: "Zoom level" })
  }

  toggleDocumentsPanel(action: "Hide" | "Show") {
    return this.page.getByRole("button", { name: `${action} documents panel` }).click()
  }

  toggleDocumentsPanelProgrammatically() {
    return this.page
      .getByRole("button", { name: "Hide documents panel" })
      .evaluate((button: HTMLButtonElement) => button.click())
  }

  toggleChatPanel(action: "Hide" | "Show") {
    return this.page.getByRole("button", { name: `${action} chat panel` }).click()
  }

  writeChatMessage(message: string) {
    return this.chatMessageInput.fill(message)
  }

  documentsPanelWidth() {
    return this.documentsPanel.evaluate((panel) => panel.getBoundingClientRect().width)
  }

  chatPanelWidth() {
    return this.chatPanel.evaluate((panel) => panel.getBoundingClientRect().width)
  }

  readerAreaWidth() {
    return this.page.locator("main > section").evaluate((reader) => reader.getBoundingClientRect().width)
  }

  async resizeDocumentsPanelBy(deltaX: number, button: "left" | "right" = "left") {
    const bounds = await this.documentsPanelResizeHandle.boundingBox()
    if (!bounds) throw new Error("Documents panel resize handle was not found")

    const startX = bounds.x + bounds.width / 2
    const startY = bounds.y + bounds.height / 2
    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down({ button })
    await this.page.mouse.move(startX + deltaX, startY, { steps: 5 })
    await this.page.mouse.up({ button })
  }

  async resizeChatPanelBy(deltaWidth: number) {
    const bounds = await this.chatPanelResizeHandle.boundingBox()
    if (!bounds) throw new Error("Chat panel resize handle was not found")

    const startX = bounds.x + bounds.width / 2
    const startY = bounds.y + bounds.height / 2
    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down()
    await this.page.mouse.move(startX - deltaWidth, startY, { steps: 5 })
    await this.page.mouse.up()
  }

  async startResizingDocumentsPanel() {
    const bounds = await this.documentsPanelResizeHandle.boundingBox()
    if (!bounds) throw new Error("Documents panel resize handle was not found")

    await this.page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await this.page.mouse.down()
  }

  bodyInteractionStyles() {
    return this.page.locator("body").evaluate((body) => ({
      cursor: body.style.cursor,
      userSelect: body.style.userSelect,
    }))
  }

  setBodyInteractionStyles(styles: { cursor: string; userSelect: string }) {
    return this.page.locator("body").evaluate((body, nextStyles) => {
      body.style.cursor = nextStyles.cursor
      body.style.userSelect = nextStyles.userSelect
    }, styles)
  }

  openSelectedDocument() {
    return this.page.getByRole("button", { name: "Choose a PDF" }).click()
  }

  openAnotherSelectedDocument() {
    return this.documentsPanel.getByRole("button", { name: "Open PDF" }).click()
  }

  documentTitle(name: string) {
    return this.page.getByRole("heading", { name })
  }

  documentEntry(name: string) {
    return this.documentsPanel.getByRole("button", { exact: true, name })
  }

  documentEntries() {
    return this.documentsPanel
      .getByRole("navigation", { name: "Documents" })
      .getByRole("button")
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

  firstPageSize() {
    return this.renderedPages.first().evaluate((page) => {
      const bounds = page.getBoundingClientRect()
      return { height: bounds.height, width: bounds.width }
    })
  }

  firstPageVisibility() {
    return this.renderedPages.first().evaluate((page) => {
      const reader = page.closest<HTMLElement>('[aria-label="PDF reader"]')
      if (!reader) throw new Error("PDF reader container was not found")

      const pageBounds = page.getBoundingClientRect()
      const readerBounds = reader.getBoundingClientRect()
      return {
        bottom: pageBounds.bottom - readerBounds.bottom,
        top: pageBounds.top - readerBounds.top,
      }
    })
  }

  firstPageHorizontalVisibility() {
    return this.renderedPages.first().evaluate((page) => {
      const reader = page.closest<HTMLElement>('[aria-label="PDF reader"]')
      if (!reader) throw new Error("PDF reader container was not found")

      const pageBounds = page.getBoundingClientRect()
      const readerBounds = reader.getBoundingClientRect()
      return {
        left: pageBounds.left - readerBounds.left,
        right: readerBounds.right - pageBounds.right,
      }
    })
  }

  setReaderSize(size: { height?: number; width?: number }) {
    return this.page.locator('[aria-label="PDF reader"]').evaluate((reader, value) => {
      if (value.height !== undefined) reader.style.height = `${value.height}px`
      if (value.width !== undefined) reader.style.width = `${value.width}px`
    }, size)
  }

  readerSize() {
    return this.page.locator('[aria-label="PDF reader"]').evaluate((reader) => {
      const bounds = reader.getBoundingClientRect()
      return { height: bounds.height, width: bounds.width }
    })
  }

  horizontalOverflow() {
    return this.page.locator('[aria-label="PDF reader"]').evaluate(
      (reader) => reader.scrollWidth - reader.clientWidth,
    )
  }

  async pinchFirstPage(scaleFactor: number, steps = 10) {
    return this.dispatchZoomWheelGesture(scaleFactor, steps, false)
  }

  async ctrlScrollFirstPage() {
    return this.dispatchZoomWheelGesture(1.1, 10, true)
  }

  private async dispatchZoomWheelGesture(
    scaleFactor: number,
    steps: number,
    physicalCtrlKey: boolean,
  ) {
    return this.renderedPages.first().evaluate((page, options) => {
      const pageBounds = page.getBoundingClientRect()
      const clientX = pageBounds.left + pageBounds.width * 0.5
      const clientY = pageBounds.top + pageBounds.height * 0.35
      const pointBefore = { x: clientX, y: clientY }
      const eventScaleFactor = options.scaleFactor ** (1 / options.steps)
      let defaultPrevented = false
      if (options.physicalCtrlKey) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }))
      }
      for (let index = 0; index < options.steps; index += 1) {
        const event = new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          ctrlKey: true,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          deltaY: -100 * Math.log(eventScaleFactor),
        })
        page.dispatchEvent(event)
        defaultPrevented ||= event.defaultPrevented
      }
      if (options.physicalCtrlKey) {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "Control" }))
      }

      return { clientX, clientY, defaultPrevented, pointBefore }
    }, { physicalCtrlKey, scaleFactor, steps })
  }

  firstPagePoint(xRatio: number, yRatio: number) {
    return this.renderedPages.first().evaluate(
      (page, { xRatio: requestedXRatio, yRatio: requestedYRatio }) => {
        const bounds = page.getBoundingClientRect()
        return {
          x: bounds.left + bounds.width * requestedXRatio,
          y: bounds.top + bounds.height * requestedYRatio,
        }
      },
      { xRatio, yRatio },
    )
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

  pageTop(pageNumber: number) {
    return this.renderedPages.nth(pageNumber - 1).evaluate((page) => page.getBoundingClientRect().top)
  }

  horizontalPageGap(leftPageNumber: number, rightPageNumber: number) {
    return this.renderedPages.evaluateAll(
      (pages, { leftPageIndex, rightPageIndex }) => {
        const leftPage = pages[leftPageIndex].getBoundingClientRect()
        const rightPage = pages[rightPageIndex].getBoundingClientRect()
        return rightPage.left - leftPage.right
      },
      { leftPageIndex: leftPageNumber - 1, rightPageIndex: rightPageNumber - 1 },
    )
  }

  verticalPageGap(upperPageNumber: number, lowerPageNumber: number) {
    return this.renderedPages.evaluateAll(
      (pages, { lowerPageIndex, upperPageIndex }) => {
        const upperPage = pages[upperPageIndex].getBoundingClientRect()
        const lowerPage = pages[lowerPageIndex].getBoundingClientRect()
        return lowerPage.top - upperPage.bottom
      },
      { lowerPageIndex: lowerPageNumber - 1, upperPageIndex: upperPageNumber - 1 },
    )
  }

  pageVerticalGutters(pageNumber: number) {
    return this.renderedPages.nth(pageNumber - 1).evaluate((page) => {
      const reader = page.closest<HTMLElement>('[aria-label="PDF reader"]')
      if (!reader) throw new Error("PDF reader container was not found")

      const pageBounds = page.getBoundingClientRect()
      const readerBounds = reader.getBoundingClientRect()
      return {
        bottom: readerBounds.bottom - pageBounds.bottom,
        top: pageBounds.top - readerBounds.top,
      }
    })
  }

  spreadVisibility(leftPageNumber: number, rightPageNumber: number) {
    return this.renderedPages.evaluateAll(
      (pages, { leftPageIndex, rightPageIndex }) => {
        const reader = pages[0].closest<HTMLElement>('[aria-label="PDF reader"]')
        if (!reader) throw new Error("PDF reader container was not found")

        const readerBounds = reader.getBoundingClientRect()
        const leftPage = pages[leftPageIndex].getBoundingClientRect()
        const rightPage = pages[rightPageIndex].getBoundingClientRect()
        return {
          bottom: readerBounds.bottom - Math.max(leftPage.bottom, rightPage.bottom),
          left: Math.min(leftPage.left, rightPage.left) - readerBounds.left,
          right: readerBounds.right - Math.max(leftPage.right, rightPage.right),
          top: Math.min(leftPage.top, rightPage.top) - readerBounds.top,
        }
      },
      { leftPageIndex: leftPageNumber - 1, rightPageIndex: rightPageNumber - 1 },
    )
  }
}
